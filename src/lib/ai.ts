// AI client (PRD 8, 9, 11.2). The browser only ever talks to our own POST /api/analyze;
// the OpenRouter key exists on the server only.
import { validateFeedback } from '../../api/_lib/feedback'
import { getActivity } from '../activities/registry'
import type { AnyActivity } from '../activities/registry'
import type { AiActivityPayload, AiErrorCode, AiFeedback, SessionCore, SessionRecord } from '../types'
import { getAiConsent, getSession, updateSessionAi } from './storage'

export const ANALYZE_ENDPOINT = '/api/analyze'
/** Client gives up after 28s; the server aborts its upstream call at 25s (PRD 11.2). */
export const CLIENT_TIMEOUT_MS = 28_000
/** A `pending` session requested less than this long ago is waited for, not re-requested (PRD 9). */
export const PENDING_WAIT_MS = 30_000
export const MOCK_DELAY_MS = 700

export type AnalyzeResult =
  | { ok: true; feedback: AiFeedback; model?: string }
  | { ok: false; errorCode: AiErrorCode }

export interface RequestOutcome {
  state: 'completed' | 'failed' | 'skipped' | 'in_flight' | 'waiting' | 'noop' | 'not_found'
  /** For 'waiting': how long until a re-request would be allowed. */
  waitMs?: number
  /** For 'failed'. */
  errorCode?: AiErrorCode
}

export interface RequestOptions {
  /** Injectable clock (ms since epoch) for tests. */
  now?: () => number
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// ---- Mock mode (development only) -------------------------------------------

/** VITE_AI_MOCK=1 AND a dev build. In production builds import.meta.env.DEV is false, so this is dead code. */
export function isMockEnabled(): boolean {
  return import.meta.env.DEV === true && import.meta.env.VITE_AI_MOCK === '1'
}

/** Fixed response: clearly labelled so it is never mistaken for a real analysis. */
export const MOCK_FEEDBACK: AiFeedback = {
  summary: '개발용 목업 응답입니다. 실제 AI 분석이 아니라 고정된 문장입니다.',
  observedPoints: ['목업 모드에서는 제출한 결과물을 읽지 않습니다.', '화면 구성과 저장 흐름을 확인하는 용도입니다.'],
  strengths: [{ point: '저장 흐름 확인', evidence: '제출 직후 pending 상태로 저장된 뒤 이 응답으로 갱신되었습니다.' }],
  improvementTip: 'VITE_AI_MOCK를 끄고 서버 함수를 연결하면 실제 분석을 받을 수 있습니다.',
  nextChallenge: { title: 'SHAPE MIX 해 보기', reason: '목업 추천입니다.', activityId: 'shape-mix' },
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// ---- Network ------------------------------------------------------------------

const KNOWN_SERVER_ERRORS: AiErrorCode[] = ['timeout', 'invalid_format', 'rate_limit', 'upstream']

async function errorCodeFromResponse(res: Response): Promise<AiErrorCode> {
  if (res.status === 429) return 'rate_limit'
  try {
    const body: unknown = await res.json()
    const code = isObject(body) ? body.error : undefined
    if (typeof code === 'string' && (KNOWN_SERVER_ERRORS as string[]).includes(code)) return code as AiErrorCode
  } catch {
    // not JSON (e.g. an HTML error page): treated as upstream below
  }
  return 'upstream'
}

/**
 * POST /api/analyze. Never throws: failures come back as an errorCode.
 * With VITE_AI_MOCK=1 (dev builds only) a fixed response is returned and no request is made.
 */
export async function fetchAnalysis(payload: AiActivityPayload, signal?: AbortSignal): Promise<AnalyzeResult> {
  if (isMockEnabled()) {
    await wait(MOCK_DELAY_MS)
    return { ok: true, feedback: MOCK_FEEDBACK, model: 'mock' }
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, CLIENT_TIMEOUT_MS)
  const onOuterAbort = () => controller.abort()
  signal?.addEventListener('abort', onOuterAbort)

  try {
    let res: Response
    try {
      res = await fetch(ANALYZE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch {
      return { ok: false, errorCode: timedOut ? 'timeout' : 'network' }
    }

    if (!res.ok) return { ok: false, errorCode: await errorCodeFromResponse(res) }

    let data: unknown
    try {
      data = await res.json()
    } catch {
      return { ok: false, errorCode: timedOut ? 'timeout' : 'upstream' }
    }

    const checked = isObject(data) ? validateFeedback(data.feedback) : undefined
    if (!checked || !checked.ok) return { ok: false, errorCode: 'invalid_format' }
    return {
      ok: true,
      feedback: checked.feedback,
      model: isObject(data) && typeof data.model === 'string' ? data.model : undefined,
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onOuterAbort)
  }
}

// ---- Payload ------------------------------------------------------------------

const isTodoError = (e: unknown) => e instanceof Error && e.message.startsWith('TODO')

/** Used only in dev builds while an activity's buildAiPayload is still an unfilled stub. */
function genericPayload(session: SessionRecord, activity: AnyActivity): AiActivityPayload {
  const measured: Record<string, number | string | boolean> = {}
  if (isObject(session.measured)) {
    for (const [k, v] of Object.entries(session.measured)) {
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') measured[k] = v
    }
  }
  return {
    activityId: session.activityId,
    activityName: activity.name,
    category: session.category,
    kind: session.kind,
    difficulty: session.difficulty,
    conditions: session.conditions,
    elapsedSec: session.elapsedSec,
    measured,
    userOutput: session.output,
    rubric: activity.rubric,
    knownReference: null,
  }
}

function buildPayload(session: SessionRecord): AiActivityPayload {
  const activity = getActivity(session.activityId)
  if (!activity) throw new Error(`unknown activity: ${session.activityId}`)
  const core: SessionCore<unknown, unknown> = {
    id: session.id,
    activityId: session.activityId,
    difficulty: session.difficulty,
    conditions: session.conditions,
    elapsedSec: session.elapsedSec,
    timedOut: session.timedOut,
    output: session.output,
    measured: session.measured,
  }
  try {
    return activity.buildAiPayload(core)
  } catch (e) {
    if (import.meta.env.DEV && isTodoError(e)) {
      console.warn(`[ai] ${activity.id}.buildAiPayload is not implemented yet; using a generic payload (dev only)`)
      return genericPayload(session, activity)
    }
    throw e
  }
}

// ---- Orchestration ------------------------------------------------------------

/**
 * True once the page is going away (reload, tab close). The browser aborts a running fetch at that
 * moment, which would otherwise be stored as a "network" failure. While this is set a failed
 * request is NOT written, so the session stays `pending` and the 30s rule handles it after reload.
 */
let pageUnloading = false
export const markPageUnloading = (value = true): void => {
  pageUnloading = value
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => markPageUnloading(true))
  window.addEventListener('pageshow', () => markPageUnloading(false)) // restored from the back/forward cache
}

/** Session ids with a request currently running in this page (module state, not persisted). */
const inFlight = new Set<string>()

export const isInFlight = (sessionId: string): boolean => inFlight.has(sessionId)

/**
 * Call on RESULT entry. Sends at most one analysis request for a `pending` session:
 * - no consent -> status becomes 'skipped', nothing is sent
 * - already running in this page (inFlight) -> 'in_flight'
 * - `pending` with requestedAt under 30s ago and not running here (page was reloaded) -> 'waiting'
 * - otherwise the request goes out and the result is merged into the stored `ai` field only.
 * Sessions that are not `pending` are left alone ('noop'); use retryAnalysis for those.
 */
export async function requestAnalysis(sessionId: string, options: RequestOptions = {}): Promise<RequestOutcome> {
  const clock = options.now ?? Date.now
  const session = getSession(sessionId)
  if (!session) return { state: 'not_found' }
  if (session.ai.status !== 'pending') return { state: 'noop' }
  if (inFlight.has(sessionId)) return { state: 'in_flight' }

  if (getAiConsent() !== true) {
    updateSessionAi(sessionId, { status: 'skipped' })
    return { state: 'skipped' }
  }

  const startedAt = clock()
  const previous = session.ai.requestedAt ? Date.parse(session.ai.requestedAt) : Number.NaN
  if (Number.isFinite(previous) && startedAt >= previous && startedAt - previous < PENDING_WAIT_MS) {
    return { state: 'waiting', waitMs: PENDING_WAIT_MS - (startedAt - previous) }
  }

  inFlight.add(sessionId)
  try {
    updateSessionAi(sessionId, { requestedAt: new Date(startedAt).toISOString() })

    let payload: AiActivityPayload
    try {
      payload = buildPayload(session)
    } catch {
      console.error('[ai] could not build the analysis payload')
      updateSessionAi(sessionId, {
        status: 'failed',
        errorCode: 'invalid_format',
        respondedAt: new Date(clock()).toISOString(),
      })
      return { state: 'failed', errorCode: 'invalid_format' }
    }

    let result: AnalyzeResult
    try {
      result = await fetchAnalysis(payload)
    } catch {
      result = { ok: false, errorCode: 'network' }
    }

    if (!result.ok && pageUnloading) return { state: 'waiting', waitMs: PENDING_WAIT_MS }

    const respondedAt = new Date(clock()).toISOString()
    if (result.ok) {
      updateSessionAi(sessionId, {
        status: 'success',
        feedback: result.feedback,
        model: result.model,
        respondedAt,
        errorCode: undefined,
      })
      return { state: 'completed' }
    }
    updateSessionAi(sessionId, { status: 'failed', errorCode: result.errorCode, respondedAt })
    return { state: 'failed', errorCode: result.errorCode }
  } finally {
    inFlight.delete(sessionId)
  }
}

/**
 * Manual re-analysis for a `failed` session, or a `skipped` one once consent has been given.
 * Resets the ai field to a clean `pending` and runs requestAnalysis. Anything else is a no-op.
 */
export async function retryAnalysis(sessionId: string, options: RequestOptions = {}): Promise<RequestOutcome> {
  const session = getSession(sessionId)
  if (!session) return { state: 'not_found' }
  if (inFlight.has(sessionId)) return { state: 'in_flight' }
  if (session.ai.status !== 'failed' && session.ai.status !== 'skipped') return { state: 'noop' }
  if (getAiConsent() !== true) return { state: 'skipped' }

  updateSessionAi(sessionId, {
    status: 'pending',
    errorCode: undefined,
    feedback: undefined,
    model: undefined,
    requestedAt: undefined,
    respondedAt: undefined,
  })
  return requestAnalysis(sessionId, options)
}

/** Name used by the original stub; same function. */
export const analyzeSession = requestAnalysis
