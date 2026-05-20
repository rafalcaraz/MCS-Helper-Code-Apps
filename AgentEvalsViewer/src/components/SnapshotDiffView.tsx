import { useMemo, useState } from 'react'
import {
  Badge,
  Body1,
  Caption1,
  Card,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Subtitle1,
  Subtitle2,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowSwap20Regular,
  ChevronDown20Regular,
  ChevronRight20Regular,
} from '@fluentui/react-icons'
import { Link as RouterLink } from 'react-router-dom'
import type { AgentSnapshot } from '../lib/snapshotParser'
import {
  diffSnapshots,
  summarizeChange,
  type ComponentChange,
  type PromptDiffLine,
} from '../lib/snapshotDiff'
import { formatDateTime } from '../lib/eval'
import { useTestRuns } from '../api/queries'
import { useAgentSnapshots } from '../hooks/useAgentSnapshots'

const useStyles = makeStyles({
  card: {
    ...shorthands.padding(tokens.spacingVerticalL),
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
    ...shorthands.border('1px', 'solid', tokens.colorBrandStroke2),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  headerIcon: {
    color: tokens.colorBrandForeground1,
  },
  versusRow: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  versusLine: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  versusLabel: {
    minWidth: '24px',
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
  },
  versusLabelA: {
    color: tokens.colorPaletteRedForeground1,
  },
  versusLabelB: {
    color: tokens.colorPaletteGreenForeground1,
  },
  versusMeta: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  summaryChips: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: tokens.spacingHorizontalS,
    rowGap: tokens.spacingVerticalXS,
  },
  noChanges: {
    color: tokens.colorPaletteGreenForeground1,
    fontStyle: 'italic',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
    ...shorthands.padding(tokens.spacingVerticalS, '0px'),
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    cursor: 'pointer',
    userSelect: 'none',
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
  },
  changeList: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    ...shorthands.padding('0px', '0px', '0px', tokens.spacingHorizontalL),
  },
  addedItem: {
    color: tokens.colorPaletteGreenForeground1,
  },
  removedItem: {
    color: tokens.colorPaletteRedForeground1,
  },
  modifiedItem: {
    color: tokens.colorPaletteYellowForeground2,
  },
  fieldRow: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  fieldLabel: {
    fontWeight: tokens.fontWeightSemibold,
  },
  fromTo: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  beforeValue: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    ...shorthands.padding('2px', tokens.spacingHorizontalXS),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
  afterValue: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    color: tokens.colorPaletteGreenForeground1,
    ...shorthands.padding('2px', tokens.spacingHorizontalXS),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
  arrow: {
    color: tokens.colorNeutralForeground3,
  },
  promptDiff: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalS),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    maxHeight: '420px',
    overflowY: 'auto',
  },
  promptLine: {
    display: 'block',
    whiteSpace: 'pre-wrap',
    ...shorthands.padding('0px', tokens.spacingHorizontalS),
    lineHeight: '1.45',
  },
  promptAdded: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    color: tokens.colorPaletteGreenForeground1,
  },
  promptRemoved: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    textDecorationLine: 'line-through',
  },
  promptSame: {
    color: tokens.colorNeutralForeground2,
  },
  itemMeta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
})

export interface SnapshotDiffViewProps {
  a: AgentSnapshot
  b: AgentSnapshot
  /**
   * Pass agentId to enable the "runs in between" coverage warning. Without it
   * the diff is still rendered, just without any claims about which runs the
   * diff does/doesn't cover.
   */
  agentId?: string
}

/**
 * Renders a structured diff between two AgentSnapshots — typically a
 * baseline (A) and a newer snapshot (B). Designed to be folded inline above
 * the cards for snapshot B on the AgentSnapshotPage.
 */
export function SnapshotDiffView({ a, b, agentId }: SnapshotDiffViewProps) {
  const styles = useStyles()
  const diff = useMemo(() => diffSnapshots(a, b), [a, b])
  const { summary } = diff
  const gap = useBetweenRunsGap(agentId, a, b)

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <ArrowSwap20Regular className={styles.headerIcon} />
        <Subtitle1>What changed</Subtitle1>
      </div>

      <div className={styles.versusRow}>
        <div className={styles.versusLine}>
          <span className={`${styles.versusLabel} ${styles.versusLabelA}`}>A</span>
          <Body1>{a.label?.trim() || `Uploaded ${formatDateTime(a.uploadedAt)}`}</Body1>
          <Caption1 className={styles.versusMeta}>
            · entity v{a.entityVersion}
            {a.publishedOn ? ` · published ${formatDateTime(a.publishedOn)}` : ''}
          </Caption1>
        </div>
        <div className={styles.versusLine}>
          <span className={`${styles.versusLabel} ${styles.versusLabelB}`}>B</span>
          <Body1>{b.label?.trim() || `Uploaded ${formatDateTime(b.uploadedAt)}`}</Body1>
          <Caption1 className={styles.versusMeta}>
            · entity v{b.entityVersion}
            {b.publishedOn ? ` · published ${formatDateTime(b.publishedOn)}` : ''}
          </Caption1>
        </div>
      </div>

      {gap && gap.uncoveredRuns.length > 0 ? (
        <MessageBar intent="warning">
          <MessageBarBody>
            <MessageBarTitle>
              {gap.uncoveredRuns.length} eval{' '}
              {gap.uncoveredRuns.length === 1 ? 'run' : 'runs'} between these
              two snapshots have no uploaded snapshot
            </MessageBarTitle>
            <div>
              The agent may have changed during those runs in ways this diff
              can't see. Treat this comparison as "differences between the two
              uploaded states," not "everything that changed between these two
              points in time."
              {agentId ? (
                <>
                  {' '}Missed runs:{' '}
                  {gap.uncoveredRuns.slice(0, 5).map((r, i) => (
                    <span key={r.id}>
                      {i > 0 ? ', ' : ''}
                      <RouterLink
                        to={`/agents/${agentId}/runs/${r.id}`}
                        style={{ color: 'inherit' }}
                      >
                        {r.name?.trim() || r.id?.slice(0, 8)}
                      </RouterLink>
                    </span>
                  ))}
                  {gap.uncoveredRuns.length > 5
                    ? `, and ${gap.uncoveredRuns.length - 5} more`
                    : ''}
                  {gap.coveredRuns.length > 0
                    ? ` · ${gap.coveredRuns.length} intermediate ${
                        gap.coveredRuns.length === 1 ? 'run does' : 'runs do'
                      } have a snapshot (not shown here).`
                    : ''}
                </>
              ) : null}
            </div>
          </MessageBarBody>
        </MessageBar>
      ) : null}

      {summary.totalChanges === 0 ? (
        <Body1 className={styles.noChanges}>
          ✓ No functional differences between these two snapshots.
        </Body1>
      ) : (
        <div className={styles.summaryChips}>
          <Chip
            n={summary.topicsAdded + summary.topicsRemoved + summary.topicsModified}
            label="topic"
            visible={
              summary.topicsAdded > 0 ||
              summary.topicsRemoved > 0 ||
              summary.topicsModified > 0
            }
          />
          <Chip
            n={summary.ksAdded + summary.ksRemoved + summary.ksModified}
            label="knowledge source"
            visible={
              summary.ksAdded > 0 ||
              summary.ksRemoved > 0 ||
              summary.ksModified > 0
            }
          />
          <Chip
            n={summary.flowsAdded + summary.flowsRemoved + summary.flowsModified}
            label="flow"
            visible={
              summary.flowsAdded > 0 ||
              summary.flowsRemoved > 0 ||
              summary.flowsModified > 0
            }
          />
          <Chip
            n={summary.settingsChanged}
            label="setting"
            visible={summary.settingsChanged > 0}
          />
          {summary.promptChanged ? (
            <Badge appearance="filled" color="warning">
              System prompt changed (+{summary.promptLinesAdded} −
              {summary.promptLinesRemoved})
            </Badge>
          ) : null}
          {summary.metaChanged > 0 ? (
            <Badge appearance="outline" color="subtle">
              {summary.metaChanged} meta field
              {summary.metaChanged === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </div>
      )}

      {diff.aiSettings.length > 0 ? (
        <DiffSection title={`AI configuration · ${diff.aiSettings.length} changed`}>
          <div className={styles.changeList}>
            {diff.aiSettings.map((s) => (
              <FieldChange
                key={s.field}
                label={s.label}
                before={s.before}
                after={s.after}
              />
            ))}
          </div>
        </DiffSection>
      ) : null}

      {diff.gpt &&
      (diff.gpt.lines.some((l) => l.kind !== 'same') ||
        diff.gpt.webBrowsingChange ||
        diff.gpt.modelChange) ? (
        <DiffSection
          title={`System prompt · +${diff.gpt.addedLines} added · −${diff.gpt.removedLines} removed`}
        >
          {diff.gpt.modelChange ? (
            <FieldChange
              label={diff.gpt.modelChange.label}
              before={diff.gpt.modelChange.before}
              after={diff.gpt.modelChange.after}
            />
          ) : null}
          {diff.gpt.webBrowsingChange ? (
            <FieldChange
              label={diff.gpt.webBrowsingChange.label}
              before={diff.gpt.webBrowsingChange.before}
              after={diff.gpt.webBrowsingChange.after}
            />
          ) : null}
          {diff.gpt.lines.some((l) => l.kind !== 'same') ? (
            <PromptDiff lines={diff.gpt.lines} />
          ) : null}
        </DiffSection>
      ) : null}

      {hasComponentChanges(diff.topics) ? (
        <DiffSection
          title={`Topics · +${diff.topics.added.length} −${diff.topics.removed.length} ~${diff.topics.modified.length}`}
        >
          <ComponentChangesList
            added={diff.topics.added.map((t) => ({
              id: t.id,
              label: t.displayName,
              meta: t.isSystemTopic ? 'system' : undefined,
            }))}
            removed={diff.topics.removed.map((t) => ({
              id: t.id,
              label: t.displayName,
              meta: t.isSystemTopic ? 'system' : undefined,
            }))}
            modified={diff.topics.modified.map((m) => ({
              id: m.id,
              label: m.after.displayName,
              changedFields: m.changedFields,
            }))}
          />
        </DiffSection>
      ) : null}

      {hasComponentChanges(diff.knowledgeSources) ? (
        <DiffSection
          title={`Knowledge sources · +${diff.knowledgeSources.added.length} −${diff.knowledgeSources.removed.length} ~${diff.knowledgeSources.modified.length}`}
        >
          <ComponentChangesList
            added={diff.knowledgeSources.added.map((k) => ({
              id: k.id,
              label: k.displayName,
              meta: k.sourceUrl,
            }))}
            removed={diff.knowledgeSources.removed.map((k) => ({
              id: k.id,
              label: k.displayName,
              meta: k.sourceUrl,
            }))}
            modified={diff.knowledgeSources.modified.map((m) => ({
              id: m.id,
              label: m.after.displayName,
              changedFields: m.changedFields,
            }))}
          />
          {diff.knowledgeSources.modified.length > 0 ? (
            <div className={styles.changeList}>
              {diff.knowledgeSources.modified.map((m) =>
                m.changedFields.includes('sourceUrl') ? (
                  <FieldChange
                    key={`ksurl-${m.id}`}
                    label={`${m.after.displayName} → URL`}
                    before={m.before.sourceUrl}
                    after={m.after.sourceUrl}
                  />
                ) : null,
              )}
            </div>
          ) : null}
        </DiffSection>
      ) : null}

      {diff.flows.added.length +
        diff.flows.removed.length +
        diff.flows.modified.length >
      0 ? (
        <DiffSection
          title={`Flows · +${diff.flows.added.length} −${diff.flows.removed.length} ~${diff.flows.modified.length}`}
        >
          <ComponentChangesList
            added={diff.flows.added.map((f) => ({
              id: f.workflowId ?? f.displayName,
              label: f.displayName,
              meta: f.isEnabled === false ? 'disabled' : undefined,
            }))}
            removed={diff.flows.removed.map((f) => ({
              id: f.workflowId ?? f.displayName,
              label: f.displayName,
            }))}
            modified={diff.flows.modified.map((m) => ({
              id: m.id,
              label: m.after.displayName,
              changedFields: m.changedFields,
            }))}
          />
        </DiffSection>
      ) : null}

      {diff.meta.length > 0 ? (
        <DiffSection title={`Entity meta · ${diff.meta.length} changed`}>
          <div className={styles.changeList}>
            {diff.meta.map((m) => (
              <FieldChange
                key={m.field}
                label={m.field}
                before={m.before}
                after={m.after}
              />
            ))}
          </div>
        </DiffSection>
      ) : null}
    </Card>
  )
}

function Chip({ n, label, visible }: { n: number; label: string; visible: boolean }) {
  if (!visible) return null
  return (
    <Badge appearance="filled" color="brand">
      {n} {label}
      {n === 1 ? '' : 's'}
    </Badge>
  )
}

function DiffSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const styles = useStyles()
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.section}>
      <div
        className={styles.sectionHeader}
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((v) => !v)
          }
        }}
      >
        {open ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
        <Subtitle2 className={styles.sectionTitle}>{title}</Subtitle2>
      </div>
      {open ? children : null}
    </div>
  )
}

function FieldChange({
  label,
  before,
  after,
}: {
  label: string
  before: unknown
  after: unknown
}) {
  const styles = useStyles()
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.fromTo}>
        <span className={styles.beforeValue}>{summarizeChange(before)}</span>
        <span className={styles.arrow}>→</span>
        <span className={styles.afterValue}>{summarizeChange(after)}</span>
      </div>
    </div>
  )
}

interface AddRemoveItem {
  id: string
  label: string
  meta?: string
}
interface ModifiedItem {
  id: string
  label: string
  changedFields: string[]
}

function ComponentChangesList({
  added,
  removed,
  modified,
}: {
  added: AddRemoveItem[]
  removed: AddRemoveItem[]
  modified: ModifiedItem[]
}) {
  const styles = useStyles()
  return (
    <div className={styles.changeList}>
      {added.map((it) => (
        <div key={`a-${it.id}`} className={styles.addedItem}>
          + {it.label}
          {it.meta ? (
            <Caption1 className={styles.itemMeta}> · {it.meta}</Caption1>
          ) : null}
        </div>
      ))}
      {removed.map((it) => (
        <div key={`r-${it.id}`} className={styles.removedItem}>
          − {it.label}
          {it.meta ? (
            <Caption1 className={styles.itemMeta}> · {it.meta}</Caption1>
          ) : null}
        </div>
      ))}
      {modified.map((it) => (
        <div key={`m-${it.id}`} className={styles.modifiedItem}>
          ~ {it.label}
          <Caption1 className={styles.itemMeta}>
            {' · '}
            {it.changedFields.join(', ')}
          </Caption1>
        </div>
      ))}
    </div>
  )
}

function PromptDiff({ lines }: { lines: PromptDiffLine[] }) {
  const styles = useStyles()
  return (
    <div className={styles.promptDiff}>
      {lines.map((l, i) => (
        <span
          key={i}
          className={`${styles.promptLine} ${
            l.kind === 'added'
              ? styles.promptAdded
              : l.kind === 'removed'
                ? styles.promptRemoved
                : styles.promptSame
          }`}
        >
          {l.kind === 'added' ? '+ ' : l.kind === 'removed' ? '− ' : '  '}
          {l.text.length === 0 ? '\u00a0' : l.text}
        </span>
      ))}
    </div>
  )
}

function hasComponentChanges<T>(d: {
  added: T[]
  removed: T[]
  modified: ComponentChange<never>[] | { id: string }[]
}): boolean {
  return d.added.length + d.removed.length + d.modified.length > 0
}

interface BetweenRunsGap {
  uncoveredRuns: { id?: string; name?: string }[]
  coveredRuns: { id?: string }[]
}

/**
 * When BOTH snapshots have an evalRunId, look at the agent's run list and
 * identify other eval runs whose startTime falls strictly between snapshot A
 * and snapshot B's runs — that's the "blind spot" the user needs to know
 * about. Runs in that window that also have an uploaded snapshot are
 * "covered" and excluded from the warning. Returns null when we lack the
 * info to make a factual claim (no agentId, missing evalRunId on A or B,
 * runs not yet loaded).
 */
function useBetweenRunsGap(
  agentId: string | undefined,
  a: AgentSnapshot,
  b: AgentSnapshot,
): BetweenRunsGap | null {
  const runsQuery = useTestRuns(agentId)
  const { snapshots } = useAgentSnapshots(agentId ?? '')

  return useMemo(() => {
    if (!agentId) return null
    if (!a.evalRunId || !b.evalRunId) return null
    if (!runsQuery.data) return null

    const aId = a.evalRunId.toLowerCase()
    const bId = b.evalRunId.toLowerCase()
    const runA = runsQuery.data.find((r) => r.id?.toLowerCase() === aId)
    const runB = runsQuery.data.find((r) => r.id?.toLowerCase() === bId)
    if (!runA?.startTime || !runB?.startTime) return null

    const earlyTs = Math.min(
      Date.parse(runA.startTime),
      Date.parse(runB.startTime),
    )
    const lateTs = Math.max(
      Date.parse(runA.startTime),
      Date.parse(runB.startTime),
    )
    if (!Number.isFinite(earlyTs) || !Number.isFinite(lateTs)) return null

    const coveredRunIds = new Set(
      snapshots
        .map((s) => s.evalRunId?.toLowerCase())
        .filter((v): v is string => Boolean(v)),
    )
    // Always exclude the two endpoint runs themselves from the gap counts.
    coveredRunIds.add(aId)
    coveredRunIds.add(bId)

    const intermediate = runsQuery.data.filter((r) => {
      if (!r.startTime || !r.id) return false
      const ts = Date.parse(r.startTime)
      if (!Number.isFinite(ts)) return false
      return ts > earlyTs && ts < lateTs
    })

    const uncoveredRuns = intermediate.filter(
      (r) => !coveredRunIds.has(r.id!.toLowerCase()),
    )
    const coveredRuns = intermediate.filter((r) =>
      coveredRunIds.has(r.id!.toLowerCase()),
    )

    return { uncoveredRuns, coveredRuns }
  }, [agentId, a.evalRunId, b.evalRunId, runsQuery.data, snapshots])
}
