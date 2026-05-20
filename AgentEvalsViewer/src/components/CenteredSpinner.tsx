import { Spinner, makeStyles, tokens } from '@fluentui/react-components'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBlock: tokens.spacingVerticalXXXL,
  },
})

export function CenteredSpinner({ label = 'Loading…' }: { label?: string }) {
  const styles = useStyles()
  return (
    <div className={styles.root}>
      <Spinner size="medium" label={label} />
    </div>
  )
}
