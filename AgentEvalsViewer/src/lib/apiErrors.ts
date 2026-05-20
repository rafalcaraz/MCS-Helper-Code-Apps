/**
 * Classify errors thrown by the Copilot Studio PPAPI (via the
 * Power Platform connector) into a friendlier, more actionable shape.
 *
 * The connector wraps PPAPI responses in its own envelope, so a single
 * 500 from PPAPI typically surfaces in the client as:
 *   { error: { code: 502, message: 'BadGateway',
 *              innerError: { ErrorCode: 500, ErrorMessage: '<real msg>' } } }
 *
 * We try to pull `innerError.ErrorMessage` out and then sniff for
 * well-known PPAPI failure shapes (AutoMapper bugs, etc.) so we can
 * give the maker a useful hint instead of an opaque blob of JSON.
 */

export type ApiErrorKind =
  | 'automapper'
  | 'bad-gateway'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'network'
  | 'unknown'

export interface ClassifiedApiError {
  kind: ApiErrorKind
  /** Short, human-friendly title (e.g. "Copilot Studio API returned a server error"). */
  title: string
  /** One-sentence explanation. */
  message: string
  /** Optional actionable hint (multiple sentences). */
  hint?: string
  /** Raw inner message from the server, if we could find one. */
  innerMessage?: string
  /** Original status code if we could find one. */
  status?: number
}

interface MaybeEnvelope {
  error?: {
    code?: number
    message?: string
    innerError?: {
      ErrorCode?: number
      ErrorMessage?: string
    }
  }
  message?: string
  status?: number
  response?: {
    status?: number
    data?: unknown
  }
}

function asEnvelope(raw: unknown): MaybeEnvelope {
  if (raw && typeof raw === 'object') return raw as MaybeEnvelope
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as MaybeEnvelope
    } catch {
      /* fall through */
    }
  }
  return {}
}

function pullInnerMessage(env: MaybeEnvelope, fallback: string): string {
  return (
    env.error?.innerError?.ErrorMessage ??
    env.error?.message ??
    env.message ??
    fallback
  )
}

function pullStatus(env: MaybeEnvelope): number | undefined {
  return (
    env.error?.innerError?.ErrorCode ??
    env.error?.code ??
    env.response?.status ??
    env.status
  )
}

/**
 * Match the specific PPAPI AutoMapper bug we hit on c1bda0a8 (2026-05-16):
 *   "Error mapping types.
 *    Mapping types:
 *    ReadOnlyCollection`1 -> IReadOnlyList`1
 *    System.Collections.ObjectModel.ReadOnlyCollection`1[[
 *      MakerEvaluation.Abstractions.Models.MakerEvaluationTestCase, ...]]
 *    -> System.Collections.Generic.IReadOnlyList`1[[
 *      MakerEvaluation.Abstractions.Models...PublicPPAPIMakerEvaluationTestCaseResult, ...]]"
 *
 * Root cause is on the server side — PPAPI is trying to project an
 * internal `MakerEvaluationTestCase` collection into the public
 * `PublicPPAPIMakerEvaluationTestCaseResult` DTO and the mapping
 * configuration is broken (likely a partial/empty result set where the
 * mapper expected results but got definitions).
 */
function isAutoMapperBug(innerMessage: string): boolean {
  if (!innerMessage) return false
  const m = innerMessage.toLowerCase()
  return (
    m.includes('error mapping types') ||
    (m.includes('makerevaluation') && m.includes('mapping types'))
  )
}

export function classifyApiError(raw: unknown): ClassifiedApiError {
  const baseMessage =
    raw instanceof Error
      ? raw.message
      : typeof raw === 'string'
        ? raw
        : 'Unknown error'

  const env = asEnvelope(raw instanceof Error ? raw.message : raw)
  const status = pullStatus(env)
  const innerMessage = pullInnerMessage(env, baseMessage)

  if (isAutoMapperBug(innerMessage)) {
    return {
      kind: 'automapper',
      title: 'Copilot Studio API hit a server-side mapping error',
      message:
        "PPAPI returned 500 — the service couldn't map its internal test-case shape to the public response DTO.",
      hint:
        "This is a known server-side bug in Copilot Studio's evaluation API, not a problem with this dashboard or your agent's data. " +
        'It usually happens when a test set has results in an unexpected shape ' +
        '(e.g. zero test cases on the latest run, an in-progress run, or a run that errored before any case ran). ' +
        'Workarounds: (1) try a different test set on this agent, (2) trigger a fresh run that exercises at least one test case, ' +
        '(3) wait a few minutes and retry — PPAPI deploys roll forward fairly often. ' +
        'If it persists, file a Copilot Studio support ticket and reference "Error mapping types: MakerEvaluationTestCase → PublicPPAPIMakerEvaluationTestCaseResult".',
      innerMessage,
      status,
    }
  }

  if (status === 401) {
    return {
      kind: 'unauthorized',
      title: 'Not signed in',
      message: 'Your Copilot Studio session expired. Sign back in and retry.',
      innerMessage,
      status,
    }
  }
  if (status === 403) {
    return {
      kind: 'forbidden',
      title: "You don't have access to this resource",
      message:
        "Your Power Platform account doesn't have rights to read this agent's evaluation data in this environment.",
      innerMessage,
      status,
    }
  }
  if (status === 404) {
    return {
      kind: 'not-found',
      title: 'Not found',
      message:
        "Copilot Studio couldn't find this resource. It may have been deleted or you may be pointing at the wrong environment.",
      innerMessage,
      status,
    }
  }
  if (status === 502 || status === 503 || status === 504) {
    return {
      kind: 'bad-gateway',
      title: 'Copilot Studio API is temporarily unavailable',
      message: `The Power Platform connector returned ${status} (gateway error). The upstream PPAPI service may be deploying or rate-limited. Retry in a minute.`,
      innerMessage,
      status,
    }
  }
  if (
    /failed to fetch|network|cors|err_/i.test(baseMessage) &&
    status === undefined
  ) {
    return {
      kind: 'network',
      title: 'Network error',
      message:
        "Couldn't reach the Power Platform connector. Check your internet connection and any VPN/proxy settings.",
      innerMessage,
      status,
    }
  }

  return {
    kind: 'unknown',
    title: 'Something went wrong',
    message: innerMessage || 'Unknown error',
    innerMessage,
    status,
  }
}
