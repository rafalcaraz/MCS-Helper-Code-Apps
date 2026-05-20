import {
  Avatar,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import type { SystemUser } from '../api/dataverse'

const useStyles = makeStyles({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    maxWidth: '220px',
    minWidth: 0,
  },
  text: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
  guid: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
})

export interface OwnerDisplayProps {
  ownerId: string | undefined
  /** Lookup map of resolved users. Pass `undefined` while loading. */
  users?: ReadonlyMap<string, SystemUser>
  /** If true, render only the friendly name (no avatar/email). */
  compact?: boolean
}

/**
 * Render the user behind a `TestRun.ownerId` with a graceful cascade:
 *   resolved fullname → email local-part → "user xxxxxxxx…" GUID slug → "—"
 *
 * The avatar uses initials when a name resolved, and falls back to a
 * generic question-mark when only a GUID is available.
 */
export function OwnerDisplay({
  ownerId,
  users,
  compact = false,
}: OwnerDisplayProps) {
  const styles = useStyles()
  if (!ownerId) {
    return <span className={styles.empty}>—</span>
  }
  const user = users?.get(ownerId)
  const fullname = user?.fullname?.trim() || null
  const email = user?.internalemailaddress?.trim() || null
  const displayLabel =
    fullname ?? email ?? `user ${ownerId.slice(0, 8)}…`
  const tooltipParts: string[] = []
  if (fullname) tooltipParts.push(fullname)
  if (email && email !== fullname) tooltipParts.push(email)
  tooltipParts.push(`systemuserid: ${ownerId}`)
  const title = tooltipParts.join('\n')
  const isFallback = !user

  if (compact) {
    return (
      <span
        className={`${styles.root} ${styles.text} ${isFallback ? styles.guid : ''}`}
        title={title}
      >
        {displayLabel}
      </span>
    )
  }

  return (
    <span className={styles.root} title={title}>
      <Avatar
        size={20}
        name={fullname ?? email ?? undefined}
        aria-hidden
      />
      <span
        className={`${styles.text} ${isFallback ? styles.guid : ''}`}
      >
        {displayLabel}
      </span>
    </span>
  )
}

/** A version with the email rendered as a small Caption underneath the name. */
export function OwnerDisplayBlock({
  ownerId,
  users,
}: Omit<OwnerDisplayProps, 'compact'>) {
  const styles = useStyles()
  if (!ownerId) {
    return <span className={styles.empty}>—</span>
  }
  const user = users?.get(ownerId)
  const fullname = user?.fullname?.trim() || null
  const email = user?.internalemailaddress?.trim() || null
  const displayLabel =
    fullname ?? email ?? `user ${ownerId.slice(0, 8)}…`

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Avatar size={28} name={fullname ?? email ?? undefined} aria-hidden />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span className={`${styles.text} ${user ? '' : styles.guid}`}>
          {displayLabel}
        </span>
        {email && email !== displayLabel ? (
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            {email}
          </Caption1>
        ) : null}
      </span>
    </span>
  )
}
