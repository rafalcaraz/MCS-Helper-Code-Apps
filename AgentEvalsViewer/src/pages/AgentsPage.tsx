import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Skeleton,
  SkeletonItem,
  Subtitle1,
  Title2,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components'
import {
  ChevronDown16Regular,
  ChevronUp16Regular,
  Delete20Regular,
  History16Regular,
  Open16Regular,
  Search16Regular,
} from '@fluentui/react-icons'
import { useTrackedAgents } from '../hooks/useTrackedAgents'
import { useRecentVisits } from '../hooks/useLastViewedRun'
import { useAccessibleBots } from '../api/queries'
import { AgentSummaryStrip } from '../components/AgentSummaryStrip'
import { RecentlyViewedCard } from '../components/RecentlyViewedCard'
import { RetentionBanner } from '../components/RetentionBanner'
import { CopyIdButton } from '../components/CopyIdButton'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalL,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'baseline',
    columnGap: tokens.spacingHorizontalM,
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalXL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  searchField: {
    flexGrow: 1,
    minWidth: '240px',
    maxWidth: '420px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  listItem: {
    display: 'flex',
    alignItems: 'flex-start',
    columnGap: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
  },
  itemBody: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minWidth: 0,
  },
  itemTitleRow: {
    display: 'flex',
    alignItems: 'baseline',
    columnGap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  itemSchema: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
  itemId: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  idRow: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    minWidth: 0,
  },
  recentToggleRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginTop: tokens.spacingVerticalS,
  },
  emptyHint: {
    color: tokens.colorNeutralForeground3,
  },
  skeletonRow: {
    marginBlock: tokens.spacingVerticalS,
  },
})

export function AgentsPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { agents, removeAgent } = useTrackedAgents()
  const [showRecentVisits, setShowRecentVisits] = useState(false)
  const [discoveredFilter, setDiscoveredFilter] = useState('')
  const recentVisits = useRecentVisits()
  const accessibleBotsQuery = useAccessibleBots()

  const discoveredBots = useMemo(
    () => accessibleBotsQuery.data ?? [],
    [accessibleBotsQuery.data],
  )

  // Bot IDs that the user already tracks manually — we hide those from
  // the discovered list so they don't show up twice.
  const trackedIds = useMemo(
    () => new Set(agents.map((a) => a.agentId)),
    [agents],
  )

  const filteredDiscovered = useMemo(() => {
    const q = discoveredFilter.trim().toLowerCase()
    const base = discoveredBots.filter((b) => !trackedIds.has(b.botId))
    if (!q) return base
    return base.filter(
      (b) =>
        b.displayName.toLowerCase().includes(q) ||
        b.schemaName.toLowerCase().includes(q) ||
        b.botId.toLowerCase().includes(q),
    )
  }, [discoveredBots, trackedIds, discoveredFilter])



  const totalAgents = agents.length + discoveredBots.length
  const isDiscoveryLoading =
    accessibleBotsQuery.isLoading && !accessibleBotsQuery.data
  const discoveryFailed = Boolean(accessibleBotsQuery.error)

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <Title2>Agents</Title2>
        <Caption1>
          {totalAgents} {totalAgents === 1 ? 'agent' : 'agents'}
          {agents.length > 0 ? ` (${agents.length} tracked)` : ''}
        </Caption1>
      </div>

      <RetentionBanner />

      {/* ── Discovered bots: the primary way to pick an agent ───── */}
      <div className={styles.card}>
        <div className={styles.sectionHeader}>
          <Subtitle1>Your agents</Subtitle1>
        </div>
        <Body1 as="p">
          Agents you have access to in this Dataverse environment. Click
          one to view its evaluation history — no setup required.
        </Body1>

        {discoveryFailed ? (
          <MessageBar intent="warning" style={{ marginTop: tokens.spacingVerticalM }}>
            <MessageBarBody>
              <MessageBarTitle>Couldn't load your agents</MessageBarTitle>
              We hit an error reading the Dataverse <code>bots</code> table.
              Check your connector permissions, or add an agent by ID below.
            </MessageBarBody>
          </MessageBar>
        ) : null}

        {isDiscoveryLoading ? (
          <div className={styles.skeletonRow}>
            <Skeleton>
              <SkeletonItem size={16} style={{ width: '320px', marginBottom: 8 }} />
              <SkeletonItem size={16} style={{ width: '280px', marginBottom: 8 }} />
              <SkeletonItem size={16} style={{ width: '300px' }} />
            </Skeleton>
          </div>
        ) : null}

        {!isDiscoveryLoading && !discoveryFailed && discoveredBots.length === 0 ? (
          <Body1 as="p" className={styles.emptyHint}>
            No agents found in this environment. If you expect to see one,
            ask the maker who owns it to grant you read access — or add it
            manually by ID below.
          </Body1>
        ) : null}

        {!isDiscoveryLoading && discoveredBots.length > 0 ? (
          <>
            <div
              className={styles.sectionTitleRow}
              style={{ marginBlock: tokens.spacingVerticalM }}
            >
              <Field className={styles.searchField}>
                <Input
                  contentBefore={<Search16Regular />}
                  value={discoveredFilter}
                  onChange={(_, data) => setDiscoveredFilter(data.value)}
                  placeholder="Filter by name, schema, or ID…"
                  aria-label="Filter discovered agents"
                />
              </Field>
              <Caption1 className={styles.emptyHint}>
                {filteredDiscovered.length} shown
                {trackedIds.size > 0
                  ? ` · ${trackedIds.size} listed under Tracked`
                  : ''}
              </Caption1>
            </div>

            {filteredDiscovered.length === 0 ? (
              <Body1 as="p" className={styles.emptyHint}>
                No agents match "{discoveredFilter}".
              </Body1>
            ) : (
              <ul className={styles.list}>
                {filteredDiscovered.map((b) => (
                  <li key={b.botId} className={styles.listItem}>
                    <div className={styles.itemBody}>
                      <div className={styles.itemTitleRow}>
                        <Body1>
                          <strong>{b.displayName}</strong>
                        </Body1>
                        {b.schemaName && b.schemaName !== b.displayName ? (
                          <Caption1 className={styles.itemSchema}>
                            {b.schemaName}
                          </Caption1>
                        ) : null}
                      </div>
                      <div className={styles.idRow}>
                        <Caption1 className={styles.itemId} title={b.botId}>
                          {b.botId}
                        </Caption1>
                        <CopyIdButton value={b.botId} noun="agent ID" iconOnly />
                      </div>
                      <AgentSummaryStrip agentId={b.botId} />
                    </div>
                    <Button
                      appearance="primary"
                      icon={<Open16Regular />}
                      onClick={() => navigate(`/agents/${b.botId}`)}
                    >
                      Open
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>

      {/* ── Tracked agents (manual): only shows if user has any ─── */}
      {agents.length > 0 ? (
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <Subtitle1>Tracked manually</Subtitle1>
          </div>
          <Body1 as="p">
            Agents you added by ID. Useful for bots from other environments
            or ones you've nicknamed.
          </Body1>
          <ul className={styles.list} style={{ marginTop: tokens.spacingVerticalM }}>
            {agents.map((a) => (
              <li key={a.agentId} className={styles.listItem}>
                <div className={styles.itemBody}>
                  <Body1>{a.nickname}</Body1>
                  <div className={styles.idRow}>
                    <Caption1 className={styles.itemId} title={a.agentId}>
                      {a.agentId}
                    </Caption1>
                    <CopyIdButton value={a.agentId} noun="agent ID" iconOnly />
                  </div>
                  <AgentSummaryStrip agentId={a.agentId} />
                </div>
                <Button
                  appearance="subtle"
                  icon={<Open16Regular />}
                  onClick={() => navigate(`/agents/${a.agentId}`)}
                >
                  Open
                </Button>
                <Button
                  appearance="subtle"
                  icon={<Delete20Regular />}
                  aria-label={`Remove ${a.nickname}`}
                  onClick={() => removeAgent(a.agentId)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Add-by-ID flow removed — discovered list above is the single
          entry point. Tracked-manually agents added previously are still
          shown so users can open or remove them. */}

      {recentVisits.length > 0 ? (
        <div className={styles.recentToggleRow}>
          <Button
            appearance="subtle"
            size="small"
            icon={
              showRecentVisits ? (
                <ChevronUp16Regular />
              ) : (
                <ChevronDown16Regular />
              )
            }
            onClick={() => setShowRecentVisits((v) => !v)}
            title={
              showRecentVisits
                ? 'Hide recently visited test sets, runs, and cases'
                : 'Jump back to a specific test set, run, or case you opened recently'
            }
          >
            <History16Regular
              style={{
                marginRight: tokens.spacingHorizontalXS,
                verticalAlign: 'text-bottom',
              }}
            />
            {showRecentVisits ? 'Hide recent visits' : 'Recent visits'} (
            {recentVisits.length})
          </Button>
        </div>
      ) : null}

      {showRecentVisits ? <RecentlyViewedCard /> : null}
    </div>
  )
}

