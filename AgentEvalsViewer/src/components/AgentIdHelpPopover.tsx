import {
  Body1,
  Button,
  Caption1,
  Link as FluentLink,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Subtitle2,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components'
import { QuestionCircle20Regular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  trigger: {
    minWidth: 'auto',
    color: tokens.colorNeutralForeground3,
  },
  surface: {
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
    ...shorthands.padding(tokens.spacingVerticalM),
  },
  block: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXXS,
  },
  step: {
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    backgroundColor: tokens.colorNeutralBackground2,
    fontSize: tokens.fontSizeBase200,
  },
  pathSnippet: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding('2px', tokens.spacingHorizontalXS),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    wordBreak: 'break-all',
  },
})

/**
 * Discoverability popover for "what counts as an Agent ID and where do I get
 * one." Placed next to the AgentsPage Add-agent form field — the place every
 * new user gets stuck.
 */
export function AgentIdHelpPopover() {
  const styles = useStyles()
  return (
    <Popover withArrow positioning="below-start">
      <PopoverTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          size="small"
          icon={<QuestionCircle20Regular />}
          aria-label="Where do I find an agent ID?"
          className={styles.trigger}
        >
          Where's my agent ID?
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.surface}>
        <Subtitle2>Where to find an Agent ID</Subtitle2>
        <Body1>
          The Agent ID is the same GUID Copilot Studio uses to identify a bot.
          You can find it three ways:
        </Body1>
        <div className={styles.block}>
          <Caption1>
            <b>1) From the Copilot Studio URL</b>
          </Caption1>
          <div className={styles.step}>
            When you open an agent in Copilot Studio, the URL contains the
            agent's GUID — it's the last segment after{' '}
            <span className={styles.pathSnippet}>/bots/</span>:
          </div>
          <div className={styles.pathSnippet}>
            https://copilotstudio.microsoft.com/environments/&lt;envId&gt;/bots/<b>&lt;THIS-IS-IT&gt;</b>/overview
          </div>
        </div>
        <div className={styles.block}>
          <Caption1>
            <b>2) From the agent's Details panel</b>
          </Caption1>
          <div className={styles.step}>
            In Copilot Studio, open your agent → click <b>Settings</b> (cog) →{' '}
            <b>Advanced</b> → the <b>Bot ID</b> field is the GUID you want.
            Some surfaces label it <b>Schema ID</b> instead.
          </div>
        </div>
        <div className={styles.block}>
          <Caption1>
            <b>3) From Power Platform admin center</b>
          </Caption1>
          <div className={styles.step}>
            <b>Resources → Copilots</b> → pick your env → click an agent →
            copy the ID from the right-hand details pane.
          </div>
        </div>
        <Caption1>
          Tip: it's the same value as the <code>cdsBotId</code> field in an
          exported <code>botcontent_&lt;guid&gt;.yaml</code>.{' '}
          <FluentLink
            href="https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-overview"
            target="_blank"
            rel="noreferrer"
          >
            Copilot Studio docs
          </FluentLink>
        </Caption1>
      </PopoverSurface>
    </Popover>
  )
}
