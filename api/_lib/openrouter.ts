import { MAX_TOKENS, OPENROUTER_URL, REASONING, TEMPERATURE } from './constants.js'

export type UpstreamErrorCode = 'timeout' | 'upstream' | 'rate_limit'

/**
 * Carries only a category. Upstream bodies, headers and the API key are never placed in the
 * message, so nothing sensitive can leak through logs or responses built from it.
 */
export class UpstreamError extends Error {
  readonly code: UpstreamErrorCode
  constructor(code: UpstreamErrorCode) {
    super(code)
    this.name = 'UpstreamError'
    this.code = code
  }
}

export interface CallOptions {
  apiKey: string
  model: string
  system: string
  user: string
  signal?: AbortSignal
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/**
 * OpenRouter Chat Completions (PRD 11.2). Mapping: 429 -> rate_limit, other non-2xx and network
 * failures -> upstream, our own abort -> timeout. `response_format` is not used: the prompt plus
 * the parser handle JSON, because free models do not reliably support JSON mode.
 */
export async function callOpenRouter(opts: CallOptions): Promise<{ content: string; model: string }> {
  const doFetch = opts.fetchImpl ?? fetch

  let res: Response
  try {
    res = await doFetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        reasoning: REASONING,
      }),
      signal: opts.signal,
    })
  } catch {
    throw new UpstreamError(opts.signal?.aborted ? 'timeout' : 'upstream')
  }

  if (res.status === 429) throw new UpstreamError('rate_limit')
  if (!res.ok) throw new UpstreamError('upstream')

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new UpstreamError(opts.signal?.aborted ? 'timeout' : 'upstream')
  }

  const choices = isObject(data) ? data.choices : undefined
  const first = Array.isArray(choices) ? choices[0] : undefined
  const message = isObject(first) ? first.message : undefined
  const content = isObject(message) ? message.content : undefined
  if (typeof content !== 'string') throw new UpstreamError('upstream')

  const usedModel = isObject(data) && typeof data.model === 'string' ? data.model : opts.model
  return { content, model: usedModel }
}
