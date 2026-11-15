import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateFeedback } from '../../api/_lib/feedback'
import type { AiActivityPayload, AiFeedback, SessionRecord } from '../types'
import {
  ANALYZE_ENDPOINT,
  CLIENT_TIMEOUT_MS,
  MOCK_DELAY_MS,
  MOCK_FEEDBACK,
  PENDING_WAIT_MS,
  isInFlight,
  markPageUnloading,
  requestAnalysis,
  retryAnalysis,
} from './ai'
import { clearAll, getSession, saveSession, saveSettings, updateSessionAi } from './storage'
import { FakeStorage } from './testing/fakeStorage'

// The real registry still has unfilled activity stubs, so it is replaced by one fake activity.
const { fakeActivity } = vi.hoisted(() => ({
  fakeActivity: { id: 'word-weave', name: 'WORD WEAVE', rubric: ['단어 간 연결'], buildAiPayload: vi.fn() },
}))
vi.mock('../activities/registry', () => ({
  getActivity: (id: string) => (id === 'word-weave' ? fakeActivity : undefined),
}))

const PAYLOAD: AiActivityPayload = {
  activityId: 'word-weave',
  activityName: 'WORD WEAVE',
  category: 'LANGUAGE',
  kind: 'open',
  difficulty: 'normal',
  conditions: ['5개 단어를 모두 사용'],
  elapsedSec: 60,
  measured: { chars: 8 },
  userOutput: { text: '새벽 계단 아래' },
  rubric: ['단어 간 연결'],
  knownReference: null,
}

const FEEDBACK: AiFeedback = {
  summary: '이번 시도에서는 단어가 이어졌어요.',
  observedPoints: ['"새벽"과 "계단"이 이어졌어요.', '문장이 짧았어요.'],
  strengths: [{ point: '단어 연결', evidence: '"새벽 계단 아래"' }],
  improvementTip: '장면의 소리를 더해 보세요.',
  nextChallenge: { title: 'SHAPE MIX', reason: '다른 표현도 해 보세요.', activityId: 'shape-mix' },
}

const NOW = Date.parse('2026-11-15T12:00:00.000Z')
const iso = (ms: number) => new Date(ms).toISOString()

const make = (id = 's', ai: SessionRecord['ai'] = { status: 'pending' }): SessionRecord => ({
  id,
  schemaVersion: 1,
  activityId: 'word-weave',
  category: 'LANGUAGE',
  kind: 'open',
  difficulty: 'normal',
  completedAt: iso(NOW - 120_000),
  conditions: ['5개 단어를 모두 사용'],
  elapsedSec: 60,
  timedOut: false,
  output: { text: '새벽 계단 아래' },
  measured: { chars: 8 },
  labels: [],
  ai,
})

const serverOk = () => new Response(JSON.stringify({ feedback: FEEDBACK, model: 'm/x:free' }), { status: 200 })
const serverError = (status: number, error: string) => new Response(JSON.stringify({ error }), { status })

let fake: FakeStorage
const fetchMock = vi.fn<typeof fetch>()
const opts = { now: () => NOW }
const consent = (value: boolean | null) => saveSettings({ schemaVersion: 1, aiConsent: value })

beforeEach(() => {
  fake = new FakeStorage()
  vi.stubGlobal('localStorage', fake)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => serverOk())
  fakeActivity.buildAiPayload.mockReset()
  fakeActivity.buildAiPayload.mockImplementation(() => PAYLOAD)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  clearAll()
  fake.clear()
  consent(true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('consent', () => {
  it.each([false, null])('marks the session skipped and sends nothing when consent is %s', async (value) => {
    consent(value)
    saveSession(make())
    expect(await requestAnalysis('s', opts)).toEqual({ state: 'skipped' })
    expect(getSession('s')!.ai.status).toBe('skipped')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('successful request', () => {
  it('sends only the payload to /api/analyze and merges the result into ai', async () => {
    const original = make()
    saveSession(original)

    expect(await requestAnalysis('s', opts)).toEqual({ state: 'completed' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(ANALYZE_ENDPOINT)
    expect(init!.method).toBe('POST')
    expect(init!.headers).toEqual({ 'Content-Type': 'application/json' }) // no credentials from the client
    expect(JSON.parse(init!.body as string)).toEqual(PAYLOAD)

    const after = getSession('s')!
    expect(after.ai).toEqual({
      status: 'success',
      requestedAt: iso(NOW),
      respondedAt: iso(NOW),
      feedback: FEEDBACK,
      model: 'm/x:free',
    })
    expect(after.output).toEqual(original.output)
    expect(after.measured).toEqual(original.measured)
    expect(after.labels).toEqual(original.labels)
  })

  it('builds the payload through the activity, handing it the session core', async () => {
    saveSession(make())
    await requestAnalysis('s', opts)
    const core = fakeActivity.buildAiPayload.mock.calls[0][0]
    expect(core).toMatchObject({ id: 's', activityId: 'word-weave', output: { text: '새벽 계단 아래' }, measured: { chars: 8 } })
  })
})

describe('duplicate-call guards', () => {
  it('two concurrent calls produce one request', async () => {
    saveSession(make())
    const [a, b] = await Promise.all([requestAnalysis('s', opts), requestAnalysis('s', opts)])
    expect([a.state, b.state].sort()).toEqual(['completed', 'in_flight'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(isInFlight('s')).toBe(false)
  })

  it('reports in-flight while a request is running', async () => {
    saveSession(make())
    let release!: () => void
    fetchMock.mockImplementation(() => new Promise((resolve) => (release = () => resolve(serverOk()))))
    const first = requestAnalysis('s', opts)
    expect(isInFlight('s')).toBe(true)
    expect(await requestAnalysis('s', opts)).toEqual({ state: 'in_flight' })
    release()
    await first
    expect(isInFlight('s')).toBe(false)
  })

  it.each(['success', 'failed', 'skipped'] as const)('does nothing for a %s session', async (status) => {
    saveSession(make('s', { status }))
    expect(await requestAnalysis('s', opts)).toEqual({ state: 'noop' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getSession('s')!.ai.status).toBe(status)
  })

  it('does a second call after success become a no-op (no second request)', async () => {
    saveSession(make())
    await requestAnalysis('s', opts)
    expect(await requestAnalysis('s', opts)).toEqual({ state: 'noop' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns not_found for an unknown session', async () => {
    expect(await requestAnalysis('nope', opts)).toEqual({ state: 'not_found' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('refresh rule for pending sessions (PRD 9)', () => {
  it('waits when requestedAt is under 30s ago and nothing is running here', async () => {
    saveSession(make('s', { status: 'pending', requestedAt: iso(NOW - 10_000) }))
    const out = await requestAnalysis('s', opts)
    expect(out).toEqual({ state: 'waiting', waitMs: PENDING_WAIT_MS - 10_000 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getSession('s')!.ai.requestedAt).toBe(iso(NOW - 10_000)) // untouched
  })

  it('re-requests once when requestedAt is 30s or more ago', async () => {
    saveSession(make('s', { status: 'pending', requestedAt: iso(NOW - PENDING_WAIT_MS) }))
    expect(await requestAnalysis('s', opts)).toEqual({ state: 'completed' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getSession('s')!.ai.status).toBe('success')
  })

  it('treats a requestedAt in the future (clock change) as stale, not as a wait', async () => {
    saveSession(make('s', { status: 'pending', requestedAt: iso(NOW + 60_000) }))
    expect(await requestAnalysis('s', opts)).toEqual({ state: 'completed' })
  })

  it('records requestedAt when it starts, so a reload right after waits', async () => {
    saveSession(make())
    let release!: () => void
    fetchMock.mockImplementation(() => new Promise((resolve) => (release = () => resolve(serverOk()))))
    const running = requestAnalysis('s', opts)
    expect(getSession('s')!.ai).toEqual({ status: 'pending', requestedAt: iso(NOW) })
    release()
    await running
  })
})

describe('failures are stored with an errorCode', () => {
  const failedWith = async () => {
    saveSession(make())
    const out = await requestAnalysis('s', opts)
    return { out, ai: getSession('s')!.ai }
  }

  it('maps HTTP 429 to rate_limit', async () => {
    fetchMock.mockImplementation(async () => serverError(429, 'rate_limit'))
    const { out, ai } = await failedWith()
    expect(out).toEqual({ state: 'failed', errorCode: 'rate_limit' })
    expect(ai).toMatchObject({ status: 'failed', errorCode: 'rate_limit', respondedAt: iso(NOW) })
  })

  it.each([
    [502, 'invalid_format', 'invalid_format'],
    [504, 'timeout', 'timeout'],
    [502, 'upstream', 'upstream'],
    [400, 'invalid_request', 'upstream'],
    [500, 'server_misconfigured', 'upstream'],
  ])('maps HTTP %i {error:%s} to %s', async (status, error, expected) => {
    fetchMock.mockImplementation(async () => serverError(status, error))
    const { ai } = await failedWith()
    expect(ai.errorCode).toBe(expected)
  })

  it('maps a non-JSON error page to upstream', async () => {
    fetchMock.mockImplementation(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    expect((await failedWith()).ai.errorCode).toBe('upstream')
  })

  it('maps a 200 that is not JSON (e.g. no API route in dev) to upstream', async () => {
    fetchMock.mockImplementation(async () => new Response('<!doctype html>', { status: 200 }))
    expect((await failedWith()).ai.errorCode).toBe('upstream')
  })

  it('maps a 200 whose feedback does not validate to invalid_format', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ feedback: { summary: 'x' } }), { status: 200 }))
    expect((await failedWith()).ai.errorCode).toBe('invalid_format')
  })

  it('maps a rejected fetch to network', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect((await failedWith()).ai.errorCode).toBe('network')
  })

  it('fails with invalid_format, without any request, if the payload cannot be built', async () => {
    fakeActivity.buildAiPayload.mockImplementation(() => {
      throw new Error('bad output shape')
    })
    const { out, ai } = await failedWith()
    expect(out).toEqual({ state: 'failed', errorCode: 'invalid_format' })
    expect(ai.status).toBe('failed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('in dev, falls back to a generic payload while an activity stub is still TODO', async () => {
    fakeActivity.buildAiPayload.mockImplementation(() => {
      throw new Error('TODO: word-weave buildAiPayload')
    })
    saveSession(make())
    expect(await requestAnalysis('s', opts)).toEqual({ state: 'completed' })
    const sent = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
    expect(sent).toMatchObject({ activityId: 'word-weave', userOutput: { text: '새벽 계단 아래' }, measured: { chars: 8 } })
  })
})

describe('page reload while a request is running', () => {
  afterEach(() => markPageUnloading(false))

  it('does not store the aborted fetch as a network failure: the session stays pending', async () => {
    saveSession(make('s'))
    vi.stubGlobal('fetch', vi.fn(async () => {
      markPageUnloading(true) // pagehide fires, then the browser aborts the fetch
      throw new TypeError('Failed to fetch')
    }))
    const outcome = await requestAnalysis('s', { now: () => NOW })
    expect(outcome.state).toBe('waiting')
    expect(getSession('s')?.ai.status).toBe('pending')
    expect(getSession('s')?.ai.errorCode).toBeUndefined()
  })

  it('still stores a real network failure when the page is not unloading', async () => {
    saveSession(make('s'))
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    await requestAnalysis('s', { now: () => NOW })
    expect(getSession('s')?.ai).toMatchObject({ status: 'failed', errorCode: 'network' })
  })
})

describe('28s client timeout', () => {
  it('aborts the request and stores errorCode timeout', async () => {
    vi.useFakeTimers({ now: NOW })
    saveSession(make())
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    expect(CLIENT_TIMEOUT_MS).toBe(28_000)

    const running = requestAnalysis('s')
    await vi.advanceTimersByTimeAsync(CLIENT_TIMEOUT_MS - 1)
    expect(isInFlight('s')).toBe(true) // not yet
    await vi.advanceTimersByTimeAsync(1)
    expect(await running).toEqual({ state: 'failed', errorCode: 'timeout' })
    expect(getSession('s')!.ai).toMatchObject({ status: 'failed', errorCode: 'timeout' })
    expect(isInFlight('s')).toBe(false)
  })
})

describe('retryAnalysis', () => {
  it('re-runs a failed session and clears the old error', async () => {
    saveSession(make('s', { status: 'failed', errorCode: 'timeout', requestedAt: iso(NOW - 5_000), respondedAt: iso(NOW - 1_000) }))
    expect(await retryAnalysis('s', opts)).toEqual({ state: 'completed' })
    const ai = getSession('s')!.ai
    expect(ai.status).toBe('success')
    expect('errorCode' in ai).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('is not blocked by the 30s wait of the failed attempt', async () => {
    saveSession(make('s', { status: 'failed', errorCode: 'upstream', requestedAt: iso(NOW - 1_000) }))
    expect((await retryAnalysis('s', opts)).state).toBe('completed')
  })

  it('analyses a skipped session once consent is given', async () => {
    saveSession(make('s', { status: 'skipped' }))
    expect((await retryAnalysis('s', opts)).state).toBe('completed')
  })

  it('leaves a skipped/failed session alone when consent is still missing', async () => {
    consent(false)
    saveSession(make('s', { status: 'failed', errorCode: 'network' }))
    expect(await retryAnalysis('s', opts)).toEqual({ state: 'skipped' })
    expect(getSession('s')!.ai).toEqual({ status: 'failed', errorCode: 'network' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['pending', 'success'] as const)('does nothing for a %s session', async (status) => {
    saveSession(make('s', { status }))
    expect(await retryAnalysis('s', opts)).toEqual({ state: 'noop' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not start a second request while one is running', async () => {
    saveSession(make('s', { status: 'failed', errorCode: 'timeout' }))
    let release!: () => void
    fetchMock.mockImplementation(() => new Promise((resolve) => (release = () => resolve(serverOk()))))
    const first = retryAnalysis('s', opts)
    expect(await retryAnalysis('s', opts)).toEqual({ state: 'in_flight' })
    release()
    await first
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns not_found for an unknown session', async () => {
    expect(await retryAnalysis('nope', opts)).toEqual({ state: 'not_found' })
  })
})

describe('mock mode (VITE_AI_MOCK=1, dev builds only)', () => {
  it('returns the fixed response, makes no request, and updates the ai field', async () => {
    vi.useFakeTimers({ now: NOW })
    vi.stubEnv('VITE_AI_MOCK', '1')
    const original = make()
    saveSession(original)

    const running = requestAnalysis('s')
    await vi.advanceTimersByTimeAsync(MOCK_DELAY_MS)
    expect(await running).toEqual({ state: 'completed' })

    expect(fetchMock).not.toHaveBeenCalled()
    const after = getSession('s')!
    expect(after.ai).toMatchObject({ status: 'success', model: 'mock', feedback: MOCK_FEEDBACK })
    expect(after.output).toEqual(original.output)
    expect(after.measured).toEqual(original.measured)
  })

  it('the fixed response itself passes the same validator as real answers', () => {
    expect(validateFeedback(MOCK_FEEDBACK).ok).toBe(true)
  })

  it('is off unless the flag is exactly "1"', async () => {
    vi.stubEnv('VITE_AI_MOCK', 'true')
    saveSession(make())
    await requestAnalysis('s', opts)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('is disabled in production builds even when the flag is set', async () => {
    vi.stubEnv('VITE_AI_MOCK', '1')
    vi.stubEnv('DEV', false)
    saveSession(make())
    await requestAnalysis('s', opts)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getSession('s')!.ai.model).toBe('m/x:free') // the real path, not 'mock'
  })
})

describe('updateSessionAi stays the only writer of ai results', () => {
  it('does not disturb a session whose ai was changed meanwhile by the user', async () => {
    saveSession(make())
    updateSessionAi('s', { status: 'skipped' })
    expect(await requestAnalysis('s', opts)).toEqual({ state: 'noop' })
  })
})
