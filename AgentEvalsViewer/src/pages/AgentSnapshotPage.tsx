import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link as RouterLink } from 'react-router-dom'
import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Dropdown,
  Link as FluentLink,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Subtitle1,
  Subtitle2,
  Switch,
  Textarea,
  Title2,
  Toast,
  ToastBody,
  ToastFooter,
  ToastTitle,
  Toaster,
  Tooltip,
  makeStyles,
  shorthands,
  tokens,
  useId,
  useToastController,
} from '@fluentui/react-components'
import {
  ArrowSwap20Regular,
  ArrowUpload24Regular,
  Bot20Regular,
  Brain20Regular,
  ChevronRight20Regular,
  Clock16Regular,
  Delete20Regular,
  DocumentText20Regular,
  Flow20Regular,
  Globe20Regular,
  Library20Regular,
  Open16Regular,
  Person16Regular,
} from '@fluentui/react-icons'
import { useTrackedAgents } from '../hooks/useTrackedAgents'
import { useAgentSnapshots } from '../hooks/useAgentSnapshots'
import { useSystemUsers } from '../api/queries'
import { OwnerDisplay } from '../components/OwnerDisplay'
import { SnapshotDiffView } from '../components/SnapshotDiffView'
import { SnapshotRunBadge } from '../components/SnapshotRunBadge'
import type { SystemUser } from '../api/dataverse'
import {
  parseSnapshot,
  countComponents,
  SnapshotParseError,
  type AgentSnapshot,
  type GptSnapshotComponent,
  type KnowledgeSourceComponent,
  type TopicComponent,
} from '../lib/snapshotParser'
import {
  extractSnapshotZip,
  isLikelyZip,
  SnapshotZipError,
} from '../lib/snapshotZip'
import { formatDateTime, formatRelativeTime } from '../lib/eval'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalL,
  },
  crumbs: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
  },
  crumbLink: {
    color: tokens.colorBrandForegroundLink,
    textDecorationLine: 'none',
    ':hover': { textDecorationLine: 'underline' },
  },
  meta: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
  uploadCard: {
    ...shorthands.padding(tokens.spacingVerticalL),
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  dropzone: {
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('2px', 'dashed', tokens.colorNeutralStroke2),
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    rowGap: tokens.spacingVerticalS,
    cursor: 'pointer',
    backgroundColor: tokens.colorNeutralBackground2,
    transition: 'background-color 120ms ease, border-color 120ms ease',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
      borderColor: tokens.colorBrandStroke1,
    },
  },
  dropzoneActive: {
    backgroundColor: tokens.colorBrandBackground2,
    borderColor: tokens.colorBrandStroke1,
  },
  dropzoneIcon: {
    color: tokens.colorBrandForeground1,
  },
  hiddenInput: {
    display: 'none',
  },
  card: {
    ...shorthands.padding(tokens.spacingVerticalL),
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  cardHeaderIcon: {
    color: tokens.colorBrandForeground1,
  },
  heroStrip: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalS,
  },
  heroCounts: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalXS,
  },
  countItem: {
    display: 'flex',
    alignItems: 'baseline',
    columnGap: tokens.spacingHorizontalXS,
  },
  bigNumber: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: 1,
  },
  countLabel: {
    color: tokens.colorNeutralForeground3,
  },
  selectorRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalS,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: tokens.spacingHorizontalS,
    rowGap: tokens.spacingVerticalXS,
  },
  ksList: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  ksItem: {
    display: 'flex',
    columnGap: tokens.spacingHorizontalM,
    alignItems: 'flex-start',
  },
  ksIcon: {
    color: tokens.colorBrandForeground1,
    flexShrink: 0,
    marginTop: '2px',
  },
  ksBody: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXXS,
    minWidth: 0,
  },
  ksUrl: {
    color: tokens.colorBrandForegroundLink,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    wordBreak: 'break-all',
  },
  topicsList: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  topicItem: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXXS,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  topicHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalXXS,
  },
  topicDesc: {
    color: tokens.colorNeutralForeground2,
  },
  topicMeta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  systemToggle: {
    alignSelf: 'flex-start',
  },
  flowsList: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  flowItem: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXXS,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  promptBox: {
    ...shorthands.padding(tokens.spacingVerticalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
    whiteSpace: 'pre-wrap',
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
    maxHeight: '320px',
    overflowY: 'auto',
  },
  emptyHint: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
  hintBox: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  pasteArea: {
    width: '100%',
  },
  pasteRow: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  ctaRow: {
    display: 'flex',
    columnGap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    rowGap: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingVerticalXL),
    color: tokens.colorNeutralForeground2,
    textAlign: 'center',
  },
  prototypeBanner: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
    color: tokens.colorPaletteYellowForeground2,
  },
  publisherChip: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    ...shorthands.padding('2px', tokens.spacingHorizontalS),
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  compareRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    rowGap: tokens.spacingVerticalXS,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorBrandBackground2,
  },
})

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5 MB — snapshots are usually <100KB

export function AgentSnapshotPage() {
  const styles = useStyles()
  const { agentId = '' } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { agents } = useTrackedAgents()
  const tracked = agents.find((a) => a.agentId === agentId)
  const {
    snapshots,
    addSnapshot,
    removeSnapshot,
    clearAll,
  } = useAgentSnapshots(agentId)
  const [selectedAt, setSelectedAt] = useState<string | null>(() => {
    const at = searchParams.get('at')
    return at && at.length > 0 ? at : null
  })
  const [compareAt, setCompareAt] = useState<string | null>(() => {
    const c = searchParams.get('compareAt')
    return c && c.length > 0 ? c : null
  })
  const [isDragging, setIsDragging] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteBusy, setPasteBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toasterId = useId('snapshot-toaster')
  const { dispatchToast } = useToastController(toasterId)

  // URL ?at= takes precedence over local state — lets snapshot marker
  // click-throughs from other pages drive selection without an effect that
  // would otherwise cascade renders (which `react-hooks/set-state-in-effect`
  // would (rightly) flag). When the user picks something else, we drop the
  // URL param and fall back to local state.
  const urlAt = searchParams.get('at')
  const urlCompareAt = searchParams.get('compareAt')
  const effectiveSelectedAt =
    urlAt && snapshots.some((s) => s.uploadedAt === urlAt)
      ? urlAt
      : selectedAt
  const effectiveCompareAt =
    urlCompareAt && snapshots.some((s) => s.uploadedAt === urlCompareAt)
      ? urlCompareAt
      : compareAt

  const selected =
    snapshots.find((s) => s.uploadedAt === effectiveSelectedAt) ??
    snapshots[0] ??
    null

  const clearAtParam = useCallback(() => {
    if (!urlAt) return
    const next = new URLSearchParams(searchParams)
    next.delete('at')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, urlAt])

  const clearCompareAtParam = useCallback(() => {
    if (!urlCompareAt) return
    const next = new URLSearchParams(searchParams)
    next.delete('compareAt')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, urlCompareAt])

  const pickCompareAt = useCallback(
    (at: string | null) => {
      setCompareAt(at)
      clearCompareAtParam()
    },
    [clearCompareAtParam],
  )

  const onPickSnapshot = useCallback(
    (at: string) => {
      setSelectedAt(at)
      if (urlAt && urlAt !== at) clearAtParam()
    },
    [clearAtParam, urlAt],
  )

  const comparison = useMemo(() => {
    if (!effectiveCompareAt || !selected) return null
    if (effectiveCompareAt === selected.uploadedAt) return null
    return snapshots.find((s) => s.uploadedAt === effectiveCompareAt) ?? null
  }, [effectiveCompareAt, selected, snapshots])

  const handleParsedSnapshot = useCallback(
    (snapshot: AgentSnapshot, fileName: string) => {
      if (snapshot.cdsBotId !== agentId) {
        const matchingTracked = agents.find(
          (a) => a.agentId === snapshot.cdsBotId,
        )
        dispatchToast(
          <Toast>
            <ToastTitle>This snapshot belongs to a different agent</ToastTitle>
            <ToastBody>
              The file's <code>cdsBotId</code> is{' '}
              <code>{snapshot.cdsBotId}</code>
              {matchingTracked
                ? ` — that's "${matchingTracked.nickname}" in your tracked agents.`
                : ' — that agent isn\'t in your tracked list.'}
            </ToastBody>
            <ToastFooter>
              {matchingTracked ? (
                <Button
                  appearance="primary"
                  size="small"
                  onClick={() =>
                    navigate(`/agents/${matchingTracked.agentId}/snapshot`)
                  }
                >
                  Switch to {matchingTracked.nickname}
                </Button>
              ) : (
                <Button
                  appearance="primary"
                  size="small"
                  onClick={() => navigate('/agents')}
                >
                  Track that agent first
                </Button>
              )}
            </ToastFooter>
          </Toast>,
          { intent: 'error', timeout: 15000 },
        )
        return
      }
      addSnapshot(snapshot)
      setSelectedAt(snapshot.uploadedAt)
      clearAtParam()
      dispatchToast(
        <Toast>
          <ToastTitle>Snapshot uploaded</ToastTitle>
          <ToastBody>
            {snapshot.displayName} · entity v{snapshot.entityVersion} ·{' '}
            {fileName}
            {snapshot.evalRunId ? (
              <>
                <br />
                🔗 Linked to eval run {snapshot.evalRunId.slice(0, 8)}…
              </>
            ) : null}
          </ToastBody>
        </Toast>,
        { intent: 'success', timeout: 4000 },
      )
    },
    [agentId, addSnapshot, agents, clearAtParam, dispatchToast, navigate],
  )

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        dispatchToast(
          <Toast>
            <ToastTitle>File too large</ToastTitle>
            <ToastBody>
              Snapshot files are usually under 100 KB. This file is{' '}
              {(file.size / 1024 / 1024).toFixed(1)} MB — refusing to parse.
            </ToastBody>
          </Toast>,
          { intent: 'error', timeout: 6000 },
        )
        return
      }
      try {
        if (isLikelyZip(file)) {
          const extracted = await extractSnapshotZip(file)
          const snapshot = parseSnapshot({
            yamlText: extracted.yamlText,
            fileName: extracted.innerFileName,
            rawSize: extracted.innerSize,
          })
          snapshot.evalRunId = extracted.evalRunId ?? undefined
          snapshot.sourceFileKind = 'zip'
          handleParsedSnapshot(snapshot, file.name)
          return
        }
        const text = await file.text()
        const snapshot = parseSnapshot({
          yamlText: text,
          fileName: file.name,
          rawSize: file.size,
        })
        // YAML filename may still carry the eval run id (botcontent_<guid>.yaml)
        const innerMatch = file.name.match(
          /^botcontent_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.ya?ml$/i,
        )
        if (innerMatch) snapshot.evalRunId = innerMatch[1].toLowerCase()
        snapshot.sourceFileKind = 'yaml'
        handleParsedSnapshot(snapshot, file.name)
      } catch (err) {
        if (err instanceof SnapshotParseError || err instanceof SnapshotZipError) {
          dispatchToast(
            <Toast>
              <ToastTitle>{err.message}</ToastTitle>
              {err.hint ? <ToastBody>{err.hint}</ToastBody> : null}
            </Toast>,
            { intent: 'error', timeout: 8000 },
          )
        } else {
          dispatchToast(
            <Toast>
              <ToastTitle>Couldn't read the file</ToastTitle>
              <ToastBody>
                {err instanceof Error ? err.message : 'Unknown error.'}
              </ToastBody>
            </Toast>,
            { intent: 'error', timeout: 6000 },
          )
        }
      }
    },
    [dispatchToast, handleParsedSnapshot],
  )

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }
  const onDragLeave: React.DragEventHandler<HTMLDivElement> = () => {
    setIsDragging(false)
  }
  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }
  const onPick: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  const handlePaste = useCallback(async () => {
    const text = pasteText.trim()
    if (!text) {
      dispatchToast(
        <Toast>
          <ToastTitle>Nothing to parse</ToastTitle>
          <ToastBody>Paste the contents of botcontent_&lt;guid&gt;.yaml first.</ToastBody>
        </Toast>,
        { intent: 'warning', timeout: 4000 },
      )
      return
    }
    if (text.length > MAX_UPLOAD_BYTES) {
      dispatchToast(
        <Toast>
          <ToastTitle>Pasted text too large</ToastTitle>
          <ToastBody>
            {(text.length / 1024 / 1024).toFixed(1)} MB exceeds the 5 MB safety
            cap.
          </ToastBody>
        </Toast>,
        { intent: 'error', timeout: 6000 },
      )
      return
    }
    setPasteBusy(true)
    try {
      const snapshot = parseSnapshot({
        yamlText: text,
        fileName: 'pasted.yaml',
        rawSize: text.length,
      })
      handleParsedSnapshot(snapshot, 'pasted.yaml')
      setPasteText('')
      setPasteOpen(false)
    } catch (err) {
      if (err instanceof SnapshotParseError) {
        dispatchToast(
          <Toast>
            <ToastTitle>{err.message}</ToastTitle>
            {err.hint ? <ToastBody>{err.hint}</ToastBody> : null}
          </Toast>,
          { intent: 'error', timeout: 8000 },
        )
      } else {
        dispatchToast(
          <Toast>
            <ToastTitle>Couldn't parse the pasted YAML</ToastTitle>
            <ToastBody>
              {err instanceof Error ? err.message : 'Unknown error.'}
            </ToastBody>
          </Toast>,
          { intent: 'error', timeout: 6000 },
        )
      }
    } finally {
      setPasteBusy(false)
    }
  }, [dispatchToast, handleParsedSnapshot, pasteText])

  return (
    <div className={styles.root}>
      <Toaster toasterId={toasterId} />

      <div className={styles.crumbs}>
        <RouterLink to="/agents" className={styles.crumbLink}>
          Agents
        </RouterLink>
        <ChevronRight20Regular />
        <RouterLink to={`/agents/${agentId}`} className={styles.crumbLink}>
          {tracked?.nickname ?? agentId}
        </RouterLink>
        <ChevronRight20Regular />
        <span>Design snapshot</span>
      </div>

      <div>
        <Title2>Design snapshot</Title2>
        <Caption1 className={styles.meta}>
          {tracked?.nickname ?? 'Agent'} · {agentId}
        </Caption1>
      </div>

      <MessageBar intent="warning" className={styles.prototypeBanner}>
        <MessageBarBody>
          <MessageBarTitle>Prototype</MessageBarTitle>
          Manual snapshot upload — paste a{' '}
          <code>botcontent_&lt;guid&gt;.yaml</code> from Copilot Studio (
          <b>Settings → Advanced → Export bot content</b>). Snapshots are stored
          in this browser's localStorage (capped at 10 per agent). No data is
          uploaded anywhere else.
        </MessageBarBody>
      </MessageBar>

      <Card className={styles.uploadCard}>
        <div className={styles.cardHeader}>
          <ArrowUpload24Regular className={styles.cardHeaderIcon} />
          <Subtitle1>Upload a snapshot</Subtitle1>
        </div>
        <div
          className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
        >
          <ArrowUpload24Regular className={styles.dropzoneIcon} />
          <Body1>
            Drop <code>evaluationBotContent.&lt;guid&gt;.zip</code> here, or
            click to browse
          </Body1>
          <Caption1 className={styles.emptyHint}>
            Get one from Copilot Studio → Settings → Advanced → Download bot
            content. We accept the <code>.zip</code> directly — the GUID in
            its filename auto-links the snapshot to the eval run it came from.
            Plain <code>.yaml</code> also works.
          </Caption1>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip,.yaml,.yml,application/x-yaml,text/yaml,text/plain"
            className={styles.hiddenInput}
            onChange={onPick}
          />
        </div>

        <div className={styles.hintBox}>
          <div className={styles.ctaRow}>
            <Subtitle2>Or paste YAML directly</Subtitle2>
            <Button
              size="small"
              appearance="subtle"
              onClick={() => setPasteOpen((v) => !v)}
            >
              {pasteOpen ? 'Hide' : 'Show'}
            </Button>
          </div>
          {pasteOpen ? (
            <div className={styles.pasteRow}>
              <Textarea
                className={styles.pasteArea}
                resize="vertical"
                rows={8}
                placeholder="Paste the contents of botcontent_<guid>.yaml here…"
                value={pasteText}
                onChange={(_, data) => setPasteText(data.value)}
              />
              <div className={styles.ctaRow}>
                <Button
                  appearance="primary"
                  onClick={() => void handlePaste()}
                  disabled={pasteBusy || !pasteText.trim()}
                >
                  Parse pasted YAML
                </Button>
                <Caption1 className={styles.emptyHint}>
                  Useful when you can't drop a file (e.g. you only have the
                  contents in chat or email).
                </Caption1>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {snapshots.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <SnapshotSelector
            snapshots={snapshots}
            selectedAt={selected?.uploadedAt ?? null}
            onSelect={(at) => {
              onPickSnapshot(at)
              if (effectiveCompareAt === at) pickCompareAt(null)
            }}
            onRemoveSelected={(at) => {
              removeSnapshot(at)
              setSelectedAt(null)
              clearAtParam()
              if (effectiveCompareAt === at) pickCompareAt(null)
            }}
            onClearAll={() => {
              if (
                window.confirm(
                  `Remove all ${snapshots.length} snapshots for this agent?`,
                )
              ) {
                clearAll()
                setSelectedAt(null)
                clearAtParam()
                pickCompareAt(null)
              }
            }}
          />
          {snapshots.length > 1 && selected ? (
            <div className={styles.compareRow}>
              <ArrowSwap20Regular />
              <Caption1>Compare with baseline:</Caption1>
              <Dropdown
                value={
                  comparison
                    ? snapshotLabel(comparison)
                    : '(none — view single snapshot)'
                }
                selectedOptions={comparison ? [comparison.uploadedAt] : ['__none']}
                onOptionSelect={(_, data) => {
                  pickCompareAt(data.optionValue === '__none' ? null : (data.optionValue ?? null))
                }}
                style={{ minWidth: '320px' }}
              >
                <Option value="__none" text="(none — view single snapshot)">
                  (none — view single snapshot)
                </Option>
                {snapshots
                  .filter((s) => s.uploadedAt !== selected.uploadedAt)
                  .map((s) => (
                    <Option
                      key={s.uploadedAt}
                      value={s.uploadedAt}
                      text={snapshotLabel(s)}
                    >
                      {snapshotLabel(s)}
                    </Option>
                  ))}
              </Dropdown>
              {comparison ? (
                <Switch
                  checked
                  onChange={() => pickCompareAt(null)}
                  label="Diff on"
                />
              ) : (
                <Caption1 className={styles.emptyHint}>
                  Pick an older snapshot to see exactly what changed.
                </Caption1>
              )}
            </div>
          ) : null}
          {selected ? (
            <SnapshotView snapshot={selected} comparisonSnapshot={comparison} agentId={agentId} />
          ) : null}
        </>
      )}

      <div>
        <Button
          appearance="subtle"
          onClick={() => navigate(`/agents/${agentId}`)}
        >
          ← Back to agent
        </Button>
      </div>
    </div>
  )
}

function EmptyState() {
  const styles = useStyles()
  return (
    <Card>
      <div className={styles.emptyState}>
        <DocumentText20Regular />
        <Body1>No snapshots yet</Body1>
        <Caption1>
          Drop a <code>botcontent_&lt;guid&gt;.yaml</code> file above to see
          your agent's authored design (topics, knowledge sources, AI settings,
          flows) inline with your evaluation results.
        </Caption1>
        <Caption1>
          Upload a second snapshot later to see <b>exactly what changed</b>{' '}
          between the two.
        </Caption1>
      </div>
    </Card>
  )
}

interface SnapshotSelectorProps {
  snapshots: AgentSnapshot[]
  selectedAt: string | null
  onSelect: (uploadedAt: string) => void
  onRemoveSelected: (uploadedAt: string) => void
  onClearAll: () => void
}

function SnapshotSelector({
  snapshots,
  selectedAt,
  onSelect,
  onRemoveSelected,
  onClearAll,
}: SnapshotSelectorProps) {
  const styles = useStyles()
  const selectedSnapshot =
    snapshots.find((s) => s.uploadedAt === selectedAt) ?? snapshots[0]
  return (
    <div className={styles.selectorRow}>
      <Caption1>Viewing:</Caption1>
      <Dropdown
        value={
          selectedSnapshot
            ? snapshotLabel(selectedSnapshot)
            : '(none)'
        }
        selectedOptions={
          selectedSnapshot ? [selectedSnapshot.uploadedAt] : []
        }
        onOptionSelect={(_, data) => {
          if (data.optionValue) onSelect(data.optionValue)
        }}
        style={{ minWidth: '320px' }}
      >
        {snapshots.map((s) => (
          <Option key={s.uploadedAt} value={s.uploadedAt} text={snapshotLabel(s)}>
            {snapshotLabel(s)}
          </Option>
        ))}
      </Dropdown>
      <Caption1>{snapshots.length} stored</Caption1>
      {selectedSnapshot ? (
        <Tooltip
          content="Remove this snapshot from localStorage"
          relationship="label"
        >
          <Button
            appearance="subtle"
            icon={<Delete20Regular />}
            onClick={() => onRemoveSelected(selectedSnapshot.uploadedAt)}
          >
            Remove
          </Button>
        </Tooltip>
      ) : null}
      {snapshots.length > 1 ? (
        <Button
          appearance="subtle"
          size="small"
          onClick={onClearAll}
        >
          Clear all
        </Button>
      ) : null}
    </div>
  )
}

function snapshotLabel(s: AgentSnapshot): string {
  const base = s.label?.trim()
  const ts = formatDateTime(s.uploadedAt)
  return base ? `${base} · ${ts}` : `Uploaded ${ts}`
}

function SnapshotView({
  snapshot,
  comparisonSnapshot,
  agentId,
}: {
  snapshot: AgentSnapshot
  comparisonSnapshot: AgentSnapshot | null
  agentId: string
}) {
  const styles = useStyles()
  const counts = useMemo(() => countComponents(snapshot), [snapshot])
  const publisherIds = useMemo(
    () => (snapshot.lastPublishedUserId ? [snapshot.lastPublishedUserId] : []),
    [snapshot.lastPublishedUserId],
  )
  const publishersQuery = useSystemUsers(publisherIds)

  return (
    <div className={styles.root}>
      <HeroStrip
        snapshot={snapshot}
        counts={counts}
        publisherUsers={publishersQuery.data}
        agentId={agentId}
      />
      {comparisonSnapshot ? (
        <SnapshotDiffView a={comparisonSnapshot} b={snapshot} agentId={agentId} />
      ) : null}
      <AIConfigCard snapshot={snapshot} />
      <KnowledgeSourcesCard snapshot={snapshot} />
      <TopicsCard snapshot={snapshot} />
      <SystemPromptCard snapshot={snapshot} />
      <FlowsCard snapshot={snapshot} />
    </div>
  )
}

interface HeroStripProps {
  snapshot: AgentSnapshot
  counts: ReturnType<typeof countComponents>
  publisherUsers: ReadonlyMap<string, SystemUser> | undefined
  agentId: string
}

function HeroStrip({ snapshot, counts, publisherUsers, agentId }: HeroStripProps) {
  const styles = useStyles()
  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <Bot20Regular className={styles.cardHeaderIcon} />
        <Subtitle1>{snapshot.displayName}</Subtitle1>
        <Badge appearance="outline" color="informative">
          entity v{snapshot.entityVersion}
        </Badge>
        {snapshot.contentVersion !== undefined ? (
          <Badge appearance="outline" color="subtle">
            content v{snapshot.contentVersion}
          </Badge>
        ) : null}
      </div>

      <div className={styles.heroCounts}>
        <CountItem n={counts.userTopics} label="user topics" />
        <CountItem n={counts.systemTopics} label="system topics" />
        <CountItem n={counts.knowledgeSources} label="knowledge sources" />
        <CountItem n={counts.gpt} label="generative AI" />
        <CountItem n={counts.flows} label="flows" />
        {counts.other > 0 ? (
          <CountItem n={counts.other} label="other components" />
        ) : null}
      </div>

      <div className={styles.chipRow}>
        <SnapshotRunBadge
          agentId={agentId}
          evalRunId={snapshot.evalRunId}
          sourceFileKind={snapshot.sourceFileKind}
        />
        {snapshot.lastPublishedAt ? (
          <Badge
            appearance="filled"
            color="brand"
            icon={<Clock16Regular />}
          >
            Published {formatRelativeTime(snapshot.lastPublishedAt)}
          </Badge>
        ) : null}
        {snapshot.publishedOn ? (
          <Caption1 className={styles.topicMeta}>
            ({formatDateTime(snapshot.publishedOn)})
          </Caption1>
        ) : null}
        {snapshot.lastPublishedUserId ? (
          <span className={styles.publisherChip}>
            <Person16Regular />
            <Caption1>by</Caption1>
            <OwnerDisplay
              ownerId={snapshot.lastPublishedUserId}
              users={publisherUsers}
            />
          </span>
        ) : null}
        {snapshot.authenticationMode ? (
          <Badge appearance="outline" color="subtle">
            Auth: {snapshot.authenticationMode}
          </Badge>
        ) : null}
        {snapshot.template ? (
          <Badge appearance="outline" color="subtle">
            Template: {snapshot.template}
          </Badge>
        ) : null}
      </div>
      <Caption1 className={styles.topicMeta}>
        Uploaded {formatRelativeTime(snapshot.uploadedAt)} ·{' '}
        {snapshot.fileName} · {(snapshot.rawSize / 1024).toFixed(1)} KB ·{' '}
        schema <code>{snapshot.schemaName}</code>
      </Caption1>
    </Card>
  )
}

function CountItem({ n, label }: { n: number; label: string }) {
  const styles = useStyles()
  return (
    <div className={styles.countItem}>
      <span className={styles.bigNumber}>{n}</span>
      <Caption1 className={styles.countLabel}>{label}</Caption1>
    </div>
  )
}

function AIConfigCard({ snapshot }: { snapshot: AgentSnapshot }) {
  const styles = useStyles()
  const ai = snapshot.aiSettings
  const gpt = snapshot.components.find(
    (c): c is GptSnapshotComponent => c.kind === 'GptComponent',
  )

  const moderationColor = (m?: string): 'success' | 'warning' | 'danger' | 'subtle' => {
    if (!m) return 'subtle'
    const v = m.toLowerCase()
    if (v === 'high') return 'success'
    if (v === 'medium') return 'subtle'
    if (v === 'low') return 'warning'
    if (v === 'none' || v === 'off') return 'danger'
    return 'subtle'
  }

  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <Brain20Regular className={styles.cardHeaderIcon} />
        <Subtitle1>AI configuration</Subtitle1>
      </div>
      <div className={styles.chipRow}>
        {gpt?.modelNameHint ? (
          <Badge appearance="filled" color="brand">
            Model: {gpt.modelNameHint}
          </Badge>
        ) : null}
        {ai.contentModeration ? (
          <Tooltip
            content="Content moderation level. Higher = safer but more refusals."
            relationship="label"
          >
            <Badge appearance="filled" color={moderationColor(ai.contentModeration)}>
              Content moderation: {ai.contentModeration}
            </Badge>
          </Tooltip>
        ) : null}
        {snapshot.recognizerKind ? (
          <Badge appearance="outline" color="subtle">
            Recognizer: {snapshot.recognizerKind}
          </Badge>
        ) : null}
        <OnOffChip
          label="Generative actions"
          value={snapshot.generativeActionsEnabled}
        />
        <OnOffChip label="Use model knowledge" value={ai.useModelKnowledge} />
        <OnOffChip label="Semantic search" value={ai.isSemanticSearchEnabled} />
        <OnOffChip label="File analysis" value={ai.isFileAnalysisEnabled} />
        <OnOffChip label="Web browsing" value={gpt?.webBrowsing} />
        <OnOffChip
          label="Opt in to latest models"
          value={ai.optInUseLatestModels}
        />
      </div>
    </Card>
  )
}

function OnOffChip({
  label,
  value,
}: {
  label: string
  value: boolean | undefined
}) {
  if (value === undefined) return null
  return (
    <Badge appearance="outline" color={value ? 'success' : 'subtle'}>
      {label}: {value ? 'On' : 'Off'}
    </Badge>
  )
}

function KnowledgeSourcesCard({ snapshot }: { snapshot: AgentSnapshot }) {
  const styles = useStyles()
  const sources = snapshot.components.filter(
    (c): c is KnowledgeSourceComponent => c.kind === 'KnowledgeSourceComponent',
  )
  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <Library20Regular className={styles.cardHeaderIcon} />
        <Subtitle1>Knowledge sources</Subtitle1>
        <Badge appearance="outline" color="subtle">
          {sources.length}
        </Badge>
      </div>
      {sources.length === 0 ? (
        <Caption1 className={styles.emptyHint}>
          No knowledge sources configured.
        </Caption1>
      ) : (
        <div className={styles.ksList}>
          {sources.map((k) => (
            <div key={k.id} className={styles.ksItem}>
              <Globe20Regular className={styles.ksIcon} />
              <div className={styles.ksBody}>
                <Subtitle2>{k.displayName}</Subtitle2>
                <Caption1 className={styles.topicMeta}>
                  {k.sourceKind ?? 'Knowledge source'}
                  {k.includeSubPages !== undefined
                    ? ` · Sub-pages ${k.includeSubPages ? 'ON' : 'OFF'}`
                    : ''}
                </Caption1>
                {k.sourceUrl ? (
                  <FluentLink
                    href={k.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.ksUrl}
                  >
                    {k.sourceUrl}
                    <Open16Regular
                      style={{ marginLeft: '4px', verticalAlign: '-2px' }}
                    />
                  </FluentLink>
                ) : null}
                {k.description ? (
                  <Caption1>{k.description}</Caption1>
                ) : null}
                {k.modifiedAt ? (
                  <Caption1 className={styles.topicMeta}>
                    Edited {formatRelativeTime(k.modifiedAt)}
                  </Caption1>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function TopicsCard({ snapshot }: { snapshot: AgentSnapshot }) {
  const styles = useStyles()
  const [showSystem, setShowSystem] = useState(false)
  const all = snapshot.components.filter(
    (c): c is TopicComponent => c.kind === 'DialogComponent',
  )
  const sorted = [...all].sort((a, b) =>
    (b.modifiedAt ?? '').localeCompare(a.modifiedAt ?? ''),
  )
  const userTopics = sorted.filter((t) => !t.isSystemTopic)
  const systemTopics = sorted.filter((t) => t.isSystemTopic)
  const shown = showSystem ? sorted : userTopics

  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <DocumentText20Regular className={styles.cardHeaderIcon} />
        <Subtitle1>Topics</Subtitle1>
        <Badge appearance="outline" color="subtle">
          {userTopics.length} authored
        </Badge>
        <Badge appearance="outline" color="subtle">
          {systemTopics.length} system
        </Badge>
      </div>
      {userTopics.length === 0 && !showSystem ? (
        <Caption1 className={styles.emptyHint}>
          No user-authored topics yet. Toggle below to see the {systemTopics.length} built-in
          system topics.
        </Caption1>
      ) : null}
      <div className={styles.topicsList}>
        {shown.map((t) => (
          <div key={t.id} className={styles.topicItem}>
            <div className={styles.topicHeader}>
              <Subtitle2>
                {t.displayName}
                {t.isSystemTopic ? (
                  <Badge
                    appearance="outline"
                    color="subtle"
                    size="small"
                    style={{ marginLeft: '8px' }}
                  >
                    system
                  </Badge>
                ) : null}
              </Subtitle2>
              <Caption1 className={styles.topicMeta}>
                {t.modifiedAt
                  ? `Edited ${formatRelativeTime(t.modifiedAt)}`
                  : ''}
              </Caption1>
            </div>
            {t.modelDescription ? (
              <Caption1 className={styles.topicDesc}>{t.modelDescription}</Caption1>
            ) : t.description ? (
              <Caption1 className={styles.topicDesc}>{t.description}</Caption1>
            ) : null}
            {t.triggerQueries && t.triggerQueries.length > 0 ? (
              <Caption1 className={styles.topicMeta}>
                Triggers:{' '}
                {t.triggerQueries
                  .slice(0, 3)
                  .map((q) => `"${q}"`)
                  .join(' · ')}
                {t.triggerQueries.length > 3
                  ? ` · +${t.triggerQueries.length - 3} more`
                  : ''}
              </Caption1>
            ) : null}
          </div>
        ))}
      </div>
      {systemTopics.length > 0 ? (
        <Button
          appearance="subtle"
          size="small"
          className={styles.systemToggle}
          onClick={() => setShowSystem((v) => !v)}
        >
          {showSystem
            ? `Hide ${systemTopics.length} system topics`
            : `Show ${systemTopics.length} system topics`}
        </Button>
      ) : null}
    </Card>
  )
}

function SystemPromptCard({ snapshot }: { snapshot: AgentSnapshot }) {
  const styles = useStyles()
  const gpt = snapshot.components.find(
    (c): c is GptSnapshotComponent => c.kind === 'GptComponent',
  )
  const hasInstructions = !!gpt?.instructions
  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <Brain20Regular className={styles.cardHeaderIcon} />
        <Subtitle1>System prompt (generative AI instructions)</Subtitle1>
        {gpt ? (
          <Badge appearance="outline" color="subtle">
            v{gpt.version}
          </Badge>
        ) : null}
      </div>
      {!gpt ? (
        <Caption1 className={styles.emptyHint}>
          No GPT component on this agent.
        </Caption1>
      ) : !hasInstructions ? (
        <Caption1 className={styles.emptyHint}>
          (empty) — no custom system prompt is configured.
        </Caption1>
      ) : (
        <div className={styles.promptBox}>{gpt.instructions}</div>
      )}
      {gpt?.modifiedAt ? (
        <Caption1 className={styles.topicMeta}>
          Edited {formatRelativeTime(gpt.modifiedAt)}
        </Caption1>
      ) : null}
    </Card>
  )
}

function FlowsCard({ snapshot }: { snapshot: AgentSnapshot }) {
  const styles = useStyles()
  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <Flow20Regular className={styles.cardHeaderIcon} />
        <Subtitle1>Flows (Power Automate as tools)</Subtitle1>
        <Badge appearance="outline" color="subtle">
          {snapshot.flows.length}
        </Badge>
      </div>
      {snapshot.flows.length === 0 ? (
        <Caption1 className={styles.emptyHint}>
          No Power Automate flows wired into this agent.
        </Caption1>
      ) : (
        <div className={styles.flowsList}>
          {snapshot.flows.map((f) => (
            <div key={f.workflowId ?? f.displayName} className={styles.flowItem}>
              <div className={styles.topicHeader}>
                <Subtitle2>{f.displayName}</Subtitle2>
                {f.isEnabled === false ? (
                  <Badge appearance="outline" color="warning">
                    Disabled
                  </Badge>
                ) : f.isEnabled === true ? (
                  <Badge appearance="outline" color="success">
                    Enabled
                  </Badge>
                ) : null}
              </div>
              <Caption1 className={styles.topicMeta}>
                {f.triggerType ? `Trigger ${f.triggerType}` : ''}
                {f.connectionType ? ` · ${f.connectionType}` : ''}
                {f.workflowId ? ` · ${f.workflowId}` : ''}
              </Caption1>
              {f.inputNames && f.inputNames.length > 0 ? (
                <Caption1 className={styles.topicMeta}>
                  Inputs: {f.inputNames.join(', ')}
                </Caption1>
              ) : null}
              {f.outputNames && f.outputNames.length > 0 ? (
                <Caption1 className={styles.topicMeta}>
                  Outputs: {f.outputNames.join(', ')}
                </Caption1>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
