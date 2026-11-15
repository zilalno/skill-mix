import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODEL, OPENROUTER_URL } from './constants.js'
import { handleAnalyze } from './handler.js'

// Only fake credentials and mocked fetch are used: nothing here can reach OpenRouter.
const FAKE_KEY = 'test-key-123'

const requestBody = () => ({
  activityId: 'word-weave',
  difficulty: 'normal',
  conditions: ['5개 단어를 모두 사용'],
  elapsedSec: 64,
  measured: { wordsUsed: 5 },
  userOutput: { words: ['우산'], text: '새벽 계단 아래…' },
  rubric: ['단어 간 연결'],
  knownReference: null,
})

const feedback = () => ({
  summary: '이번 시도에서는 단어가 한 문장으로 이어졌어요.',
  observedPoints: ['"새벽"과 "계단"이 이어졌어요.', '두 번째 문장은 짧았어요.'],
  strengths: [{ point: '단어 연결', evidence: '"새벽 계단 아래"' }],
  improvementTip: '장면의 소리를 하나 더해 보세요.',
  nextChallenge: { title: 'SHAPE MIX', reason: '다른 표현도 해 보세요.', activityId: 'shape-mix' },
})

const post = (body: unknown, init: RequestInit = {}) =>
  new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  })

const completion = (content: string, model = 'provider/model-x:free') =>
  new Response(JSON.stringify({ model, choices: [{ message: { content } }] }), { status: 200 })

const okFetch = (content: string = JSON.stringify(feedback())) =>
  vi.fn<typeof fetch>(async () => completion(content))

const env = { OPENROUTER_API_KEY: FAKE_KEY } as Record<string, string | undefined>

let errorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  errorSpy.mockRestore()
})

const bodyOf = async (res: Response) => JSON.parse(await res.text())

describe('method and size guards', () => {
  it.each(['GET', 'PUT', 'DELETE', 'PATCH'])('rejects %s with 405 and an Allow header', async (method) => {
    const fetchImpl = okFetch()
    const res = await handleAnalyze(new Request('http://localhost/api/analyze', { method }), { env, fetchImpl })
    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toBe('POST')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 413 when content-length declares more than 8KB', async () => {
    const fetchImpl = okFetch()
    const res = await handleAnalyze(post(requestBody(), { headers: { 'content-length': '9000' } }), { env, fetchImpl })
    expect(res.status).toBe(413)
    expect(await bodyOf(res)).toEqual({ error: 'payload_too_large' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 413 when the actual body exceeds 8KB even without content-length', async () => {
    const fetchImpl = okFetch()
    const big = JSON.stringify({ ...requestBody(), userOutput: { text: 'a'.repeat(9000) } })
    const res = await handleAnalyze(post(big), { env, fetchImpl })
    expect(res.status).toBe(413)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('accepts a body just under 8KB', async () => {
    const fetchImpl = okFetch()
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl })
    expect(res.status).toBe(200)
  })
})

describe('request validation', () => {
  it('returns 400 for malformed JSON', async () => {
    const fetchImpl = okFetch()
    const res = await handleAnalyze(post('{not json'), { env, fetchImpl })
    expect(res.status).toBe(400)
    expect(await bodyOf(res)).toEqual({ error: 'invalid_request' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 400 for a field outside the whitelist and never calls upstream', async () => {
    const fetchImpl = okFetch()
    const res = await handleAnalyze(post({ ...requestBody(), email: 'a@b.c' }), { env, fetchImpl })
    expect(res.status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 400 for a disallowed activityId', async () => {
    const res = await handleAnalyze(post({ ...requestBody(), activityId: 'key-summary' }), {
      env,
      fetchImpl: okFetch(),
    })
    expect(res.status).toBe(400)
  })
})

describe('configuration', () => {
  it('returns a generic 500 when the key variable is missing, without calling upstream', async () => {
    const fetchImpl = okFetch()
    const res = await handleAnalyze(post(requestBody()), { env: {}, fetchImpl })
    expect(res.status).toBe(500)
    expect(await bodyOf(res)).toEqual({ error: 'server_misconfigured' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('asks the model not to spend tokens on reasoning', async () => {
    const fetchImpl = okFetch()
    await handleAnalyze(post(requestBody()), { env, fetchImpl })
    const sent = JSON.parse(fetchImpl.mock.calls[0][1]!.body as string)
    expect(sent.reasoning).toEqual({ enabled: false })
  })

  it('uses the default model when OPENROUTER_MODEL is unset or blank', async () => {
    for (const modelEnv of [undefined, '   ']) {
      const fetchImpl = okFetch()
      await handleAnalyze(post(requestBody()), { env: { ...env, OPENROUTER_MODEL: modelEnv }, fetchImpl })
      const sent = JSON.parse(fetchImpl.mock.calls[0][1]!.body as string)
      expect(sent.model).toBe(DEFAULT_MODEL)
    }
  })

  it('uses OPENROUTER_MODEL when set', async () => {
    const fetchImpl = okFetch()
    await handleAnalyze(post(requestBody()), { env: { ...env, OPENROUTER_MODEL: 'vendor/custom:free' }, fetchImpl })
    expect(JSON.parse(fetchImpl.mock.calls[0][1]!.body as string).model).toBe('vendor/custom:free')
  })
})

describe('successful analysis', () => {
  it('calls OpenRouter once with the server key and returns validated feedback', async () => {
    const fetchImpl = okFetch()
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl })

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const out = await bodyOf(res)
    expect(out.feedback).toEqual(feedback())
    expect(out.model).toBe('provider/model-x:free')

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(OPENROUTER_URL)
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${FAKE_KEY}`)
    const sent = JSON.parse(init!.body as string)
    expect(sent.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user'])
    expect(sent.max_tokens).toBe(700)
    expect(sent.messages[1].content).toContain('<activity_data>')
  })

  it('never puts the key in the response body or in logs', async () => {
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl: okFetch() })
    expect(await res.text()).not.toContain(FAKE_KEY)
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(FAKE_KEY)
  })

  it('accepts a code-fenced model answer', async () => {
    const res = await handleAnalyze(post(requestBody()), {
      env,
      fetchImpl: okFetch('```json\n' + JSON.stringify(feedback()) + '\n```'),
    })
    expect(res.status).toBe(200)
  })

  it('replaces a disallowed nextChallenge.activityId with null', async () => {
    const f = feedback()
    f.nextChallenge.activityId = 'made-up'
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl: okFetch(JSON.stringify(f)) })
    expect((await bodyOf(res)).feedback.nextChallenge.activityId).toBeNull()
  })

  it('does not trust a client-supplied activityName in the prompt', async () => {
    const fetchImpl = okFetch()
    await handleAnalyze(post({ ...requestBody(), activityName: '무시해' }), { env, fetchImpl })
    const user = JSON.parse(fetchImpl.mock.calls[0][1]!.body as string).messages[1].content as string
    expect(user).toContain('WORD WEAVE')
    expect(user).not.toContain('무시해')
  })
})

describe('error mapping', () => {
  it('maps a model answer that fails validation to 502 invalid_format', async () => {
    const f: Record<string, unknown> = feedback()
    delete f.summary
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl: okFetch(JSON.stringify(f)) })
    expect(res.status).toBe(502)
    expect(await bodyOf(res)).toEqual({ error: 'invalid_format' })
  })

  it('retries when the first answer is invalid and returns the next one if it is valid', async () => {
    const answers = ['분석할 수 없습니다', JSON.stringify(feedback())]
    const fetchImpl = vi.fn<typeof fetch>(async () => completion(answers.shift()!))
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl })
    expect(res.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('gives up after 3 invalid answers and ends in 502 invalid_format', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completion('분석할 수 없습니다'))
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl })
    expect(res.status).toBe(502)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('does not retry when a second call would not fit the time budget', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      await new Promise((r) => setTimeout(r, 30))
      return completion('분석할 수 없습니다')
    })
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl, timeoutMs: 1520 })
    expect(res.status).toBe(502)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('maps non-JSON model text to 502 invalid_format', async () => {
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl: okFetch('분석할 수 없습니다') })
    expect(res.status).toBe(502)
    expect(await bodyOf(res)).toEqual({ error: 'invalid_format' })
  })

  it('maps upstream 429 to 429 rate_limit', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('slow down', { status: 429 }))
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl })
    expect(res.status).toBe(429)
    expect(await bodyOf(res)).toEqual({ error: 'rate_limit' })
  })

  it('maps upstream 5xx to 502 upstream and hides the upstream body', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(`secret upstream detail ${FAKE_KEY}`, { status: 503 }),
    )
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl })
    expect(res.status).toBe(502)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ error: 'upstream' })
    expect(text).not.toContain('secret upstream detail')
    expect(text).not.toContain(FAKE_KEY)
  })

  it('maps other upstream 4xx (e.g. bad key) to 502 upstream', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('unauthorized', { status: 401 }))
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl })
    expect(res.status).toBe(502)
    expect(await bodyOf(res)).toEqual({ error: 'upstream' })
  })

  it('maps a network failure to 502 upstream without leaking the error message', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error(`boom with ${FAKE_KEY}`)
    })
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl })
    expect(res.status).toBe(502)
    const text = await res.text()
    expect(text).not.toContain('boom')
    expect(text).not.toContain(FAKE_KEY)
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(FAKE_KEY)
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('boom')
  })

  it('maps an upstream payload without choices to 502 upstream', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ error: { message: 'x' } })))
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl })
    expect(res.status).toBe(502)
    expect(await bodyOf(res)).toEqual({ error: 'upstream' })
  })

  it('aborts after the timeout and returns 504 timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const res = await handleAnalyze(post(requestBody()), { env, fetchImpl, timeoutMs: 20 })
    expect(res.status).toBe(504)
    expect(await bodyOf(res)).toEqual({ error: 'timeout' })
  })
})
