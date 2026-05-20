import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  Subtitle1,
  Title2,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components'
import {
  Add24Regular,
  ChevronDown16Regular,
  ChevronUp16Regular,
  Delete20Regular,
  History16Regular,
  Open16Regular,
} from '@fluentui/react-icons'
import { useTrackedAgents } from '../hooks/useTrackedAgents'
import { useRecentVisits } from '../hooks/useLastViewedRun'
import { AgentSummaryStrip } from '../components/AgentSummaryStrip'
import { RecentlyViewedCard } from '../components/RecentlyViewedCard'
import { RetentionBanner } from '../components/RetentionBanner'
import { AgentIdHelpPopover } from '../components/AgentIdHelpPopover'
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
  formRow: {
    display: 'flex',
    columnGap: tokens.spacingHorizontalM,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  fieldGrow: {
    flexGrow: 1,
    minWidth: '220px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
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
  idHelpRow: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    minHeight: '28px',
  },
  requiredAsterisk: {
    color: tokens.colorPaletteRedForeground1,
    marginLeft: '2px',
  },
  recentToggleRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginTop: tokens.spacingVerticalS,
  },
})

export function AgentsPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { agents, addAgent, removeAgent } = useTrackedAgents()
  const [agentId, setAgentId] = useState('')
  const [nickname, setNickname] = useState('')
  const [showRecentVisits, setShowRecentVisits] = useState(false)
  const recentVisits = useRecentVisits()

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    if (!agentId.trim()) return
    addAgent({ agentId, nickname })
    setAgentId('')
    setNickname('')
  }

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <Title2>Agents</Title2>
        <Caption1>{agents.length} tracked</Caption1>
      </div>

      <RetentionBanner />

      <form className={styles.card} onSubmit={handleAdd}>
        <Subtitle1>Track an agent</Subtitle1>
        <Body1 as="p">
          Paste an agent ID (the <code>cdsBotId</code> GUID) from Copilot
          Studio. You can give it a nickname to make it easier to spot in
          your dashboard.
        </Body1>
        <div className={styles.formRow}>
          <Field
            className={styles.fieldGrow}
            label={
              <div className={styles.idHelpRow}>
                <span>
                  Agent ID
                  <span
                    className={styles.requiredAsterisk}
                    aria-hidden="true"
                  >
                    *
                  </span>
                </span>
                <AgentIdHelpPopover />
              </div>
            }
            required
          >
            <Input
              value={agentId}
              onChange={(_, data) => setAgentId(data.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </Field>
          <Field
            className={styles.fieldGrow}
            label={<div className={styles.idHelpRow}>Nickname</div>}
          >
            <Input
              value={nickname}
              onChange={(_, data) => setNickname(data.value)}
              placeholder="HR Assistant (prod)"
            />
          </Field>
          <Button
            type="submit"
            appearance="primary"
            icon={<Add24Regular />}
            disabled={!agentId.trim()}
          >
            Track agent
          </Button>
        </div>
      </form>

      {agents.length === 0 ? (
        <div className={styles.card}>
          <Subtitle1>No agents tracked yet</Subtitle1>
          <Body1 as="p">
            Add an agent above to start viewing its evaluation history.
          </Body1>
        </div>
      ) : (
        <ul
          className={styles.list}
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
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
      )}

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
