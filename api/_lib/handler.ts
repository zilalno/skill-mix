import { DEFAULT_MODEL, MAX_ATTEMPTS, MAX_BODY_BYTES, RETRY_MARGIN_MS, UPSTREAM_TIMEOUT_MS } from './constants.js'
import { parseFeedback } from './feedback.js'
import { callOpenRouter, UpstreamError } from './openrouter.js'
import { buildMessages } from './prompt.js'
import { validateAnalyzeRequest } from './validate.js'

export type ApiErrorCode =
  | 'method_not_allowed'
  | 'payload_too_large'
  | 'invalid_request'
  | 'server_misconfigured'
  | 'rate_limit'
  | 'upstream'
  | 'timeout'
  | 'invalid_format'

export interface HandlerDeps {
  /** process.env in production; a plain object in tests. */
  env: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

function json(status: number, body: unknown, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  })
}

/** Error bodies carry a code only: never upstream text, keys or internals (PRD 11.3). */
const error = (status: number, code: ApiErrorCode, extra?: Record<string, string>) =>
  json(status, { error: code }, extra)

/** Reads at most `max` bytes. Returns null when the body is larger (declared or actual). */
async function readBodyLimited(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) return null
  if (!request.body) return ''

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  const buf = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    buf.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(buf)
}

export async function handleAnalyze(request: Request, deps: HandlerDeps): Promise<Response> {
  if (request.method !== 'POST') return error(405, 'method_not_allowed', { Allow: 'POST' })

  const bodyText = await readBodyLimited(request, MAX_BODY_BYTES)
  if (bodyText === null) return error(413, 'payload_too_large')

  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    return error(400, 'invalid_request')
  }

  const validated = validateAnalyzeRequest(parsed)
  if (!validated.ok) return error(400, 'invalid_request')

  const apiKey = deps.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    console.error('[analyze] server_misconfigured: API key variable is not set')
    return error(500, 'server_misconfigured')
  }
  const model = deps.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL
  const { system, user } = buildMessages(validated.value)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? UPSTREAM_TIMEOUT_MS)
  try {
    const budgetMs = deps.timeoutMs ?? UPSTREAM_TIMEOUT_MS
    const startedAt = Date.now()
    for (let attempt = 1; ; attempt++) {
      const callStartedAt = Date.now()
      const out = await callOpenRouter({
        apiKey,
        model,
        system,
        user,
        signal: controller.signal,
        fetchImpl: deps.fetchImpl,
      })
      const result = parseFeedback(out.content)
      if (result.ok) return json(200, { feedback: result.feedback, model: out.model })
      // Logs only which field failed validation, never the model text or the user's data.
      console.error(`[analyze] invalid_format: ${result.reason}`)
      // Free models sometimes answer in the wrong language or break the JSON. Try again only if
      // another call of the same length still fits inside the budget (shared 25s abort).
      const now = Date.now()
      const fits = now - startedAt + (now - callStartedAt) < budgetMs - RETRY_MARGIN_MS
      if (attempt >= MAX_ATTEMPTS || !fits) return error(502, 'invalid_format')
    }
  } catch (e) {
    const code = e instanceof UpstreamError ? e.code : 'upstream'
    console.error(`[analyze] ${code}`)
    if (code === 'rate_limit') return error(429, 'rate_limit')
    if (code === 'timeout') return error(504, 'timeout')
    return error(502, 'upstream')
  } finally {
    clearTimeout(timer)
  }
}
