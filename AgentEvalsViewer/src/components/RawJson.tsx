import { useState } from 'react'
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  Code24Regular,
  Copy20Regular,
  Checkmark20Regular,
} from '@fluentui/react-icons'

const useStyles = makeStyles({
  root: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  body: {
    padding: tokens.spacingHorizontalL,
    paddingTop: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  pre: {
    margin: 0,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    overflow: 'auto',
    maxHeight: '420px',
    whiteSpace: 'pre',
  },
  toolbar: {
    display: 'flex',
    columnGap: tokens.spacingHorizontalS,
    justifyContent: 'flex-end',
  },
})

export interface RawJsonProps {
  title?: string
  data: unknown
  defaultOpen?: boolean
}

export function RawJson({
  title = 'Raw response',
  data,
  defaultOpen = false,
}: RawJsonProps) {
  const styles = useStyles()
  const [copied, setCopied] = useState(false)

  const json = (() => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  })()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  return (
    <Accordion
      collapsible
      defaultOpenItems={defaultOpen ? ['raw'] : []}
      className={styles.root}
    >
      <AccordionItem value="raw">
        <AccordionHeader expandIconPosition="end" icon={<Code24Regular />}>
          <span className={styles.header}>{title}</span>
        </AccordionHeader>
        <AccordionPanel>
          <div className={styles.body}>
            <div className={styles.toolbar}>
              <Button
                size="small"
                appearance="secondary"
                icon={
                  copied ? <Checkmark20Regular /> : <Copy20Regular />
                }
                onClick={handleCopy}
              >
                {copied ? 'Copied' : 'Copy JSON'}
              </Button>
            </div>
            <pre className={styles.pre}>{json}</pre>
          </div>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  )
}
