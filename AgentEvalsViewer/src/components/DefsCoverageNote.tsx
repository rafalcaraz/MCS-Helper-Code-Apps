import { useMemo } from 'react'
import {
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import type { CaseDefinitionsMap } from '../lib/metrics'

const useStyles = makeStyles({
  loading: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
})

export interface DefsCoverageNoteProps {
  runs: ReadonlyArray<TestRun>
  /** Dataverse-sourced case definitions map (may be undefined while loading). */
  definitions: CaseDefinitionsMap | undefined
  /** True while react-query is fetching `useTestCaseDefinitions`. */
  isLoading: boolean
  /** Set when the Dataverse fetch failed (auth, permission, etc.). */
  error: Error | null | undefined
}

/**
 * One-glance diagnostic for the question-label situation on the test set
 * page. Explains *why* GUID slugs may appear in the leaderboards / heatmap
 * instead of authored question text.
 *
 *   - Dataverse loading → small spinner row
 *   - Dataverse error → loud error MessageBar with cause
 *   - Dataverse loaded but 0 cases match → warning ("none of these run-time
 *     case IDs exist in the live test set anymore")
 *   - Dataverse loaded with partial coverage → info ("X of Y cases are in
 *     the live test set; Z aren't and will show as GUIDs")
 *   - Full coverage → renders nothing (no noise when everything's fine)
 */
export function DefsCoverageNote({
  runs,
  definitions,
  isLoading,
  error,
}: DefsCoverageNoteProps) {
  const styles = useStyles()

  const stats = useMemo(() => {
    const seen = new Set<string>()
    for (const r of runs) {
      for (const c of r.testCasesResults ?? []) {
        if (c.testCaseId) seen.add(c.testCaseId)
      }
    }
    const distinctRunCases = seen.size
    if (!definitions) {
      return { distinctRunCases, defsSize: 0, matched: 0, unmatched: 0 }
    }
    let matched = 0
    for (const id of seen) {
      const d = definitions.get(id)
      if (d && d.input && d.input.trim().length > 0) matched += 1
    }
    return {
      distinctRunCases,
      defsSize: definitions.size,
      matched,
      unmatched: distinctRunCases - matched,
    }
  }, [runs, definitions])

  if (isLoading) {
    return (
      <span className={styles.loading}>
        <Spinner size="extra-tiny" />
        Loading question text from Dataverse…
      </span>
    )
  }

  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>
          <MessageBarTitle>
            Couldn&apos;t load question text from Dataverse
          </MessageBarTitle>{' '}
          {error.message ?? 'Unknown Dataverse error.'} Cases will show as
          GUID slugs (<em>case xxxxxxxx…</em>) until the connection is
          restored. Verify the Dataverse connector is wired and the user
          has read access to <code>botcomponents</code> for this agent.
        </MessageBarBody>
      </MessageBar>
    )
  }

  if (stats.distinctRunCases === 0) {
    return null
  }

  if (stats.defsSize === 0) {
    return (
      <MessageBar intent="warning">
        <MessageBarBody>
          <MessageBarTitle>
            No test cases found in Dataverse for this agent
          </MessageBarTitle>{' '}
          The Dataverse query returned 0 test case rows from{' '}
          <code>botcomponents</code> with{' '}
          <code>componenttype = 19</code> (Test Case) for this bot —
          looked for both{' '}
          <code>kind: EvaluationData</code> (single-turn) and{' '}
          <code>kind: MultiTurnEvaluationCase</code> (conversational).
          All {stats.distinctRunCases} case
          {stats.distinctRunCases === 1 ? '' : 's'} from run history will
          show as GUID slugs. Likely cause: the Dataverse connection isn&apos;t
          authorized to read this agent&apos;s test cases, or the agent has no
          test cases authored in CPS yet.
        </MessageBarBody>
      </MessageBar>
    )
  }

  if (stats.matched === 0) {
    return (
      <MessageBar intent="warning">
        <MessageBarBody>
          <MessageBarTitle>
            None of the cases in run history are in the live test set
          </MessageBarTitle>{' '}
          We found <strong>{stats.defsSize}</strong> test case definition
          {stats.defsSize === 1 ? '' : 's'} in Dataverse for this agent
          (covering both single-turn and conversational kinds), but{' '}
          <strong>0</strong> of the {stats.distinctRunCases} case ID
          {stats.distinctRunCases === 1 ? '' : 's'} that appear in your run
          history match. The cases were probably <em>deleted and recreated</em>{' '}
          in Copilot Studio (which assigns fresh IDs), so historical run
          data is now orphaned. Open the test set in CPS to confirm the
          current case roster — your most recent runs should be using the
          new IDs.
        </MessageBarBody>
      </MessageBar>
    )
  }

  if (stats.unmatched > 0) {
    return (
      <MessageBar intent="info">
        <MessageBarBody>
          <MessageBarTitle>
            {stats.matched} of {stats.distinctRunCases} cases have
            authored question text
          </MessageBarTitle>{' '}
          The remaining <strong>{stats.unmatched}</strong> appeared in
          older runs but aren&apos;t in the live Dataverse test set anymore
          (likely deleted or replaced). They&apos;ll show as GUID slugs
          (<em>case xxxxxxxx…</em>) below — open any of them to see the
          historical reference text we extracted from grader explanations.
        </MessageBarBody>
      </MessageBar>
    )
  }

  return null
}
