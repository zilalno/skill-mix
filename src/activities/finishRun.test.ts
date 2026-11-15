import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_DELAY_MS, MOCK_FEEDBACK, requestAnalysis } from '../lib/ai'
import { clearAll, getAiConsent, getSession, getSessions, saveSessionDetailed, saveSettings } from '../lib/storage'
import { FakeStorage } from '../lib/testing/fakeStorage'
import type { AiActivityPayload, EvalContext } from '../types'
import { finishRun } from './finishRun'
import type { FinishDeps, FinishMeta } from './finishRun'
import type { AnyActivity } from './registry'

// One fake activity serves both finishRun (passed in) and ai.ts (via the mocked registry).
const { fakeActivity } = vi.hoisted(() => ({
  fakeActivity: {
    id: 'word-weave',
    name: 'WORD WEAVE',
    category: 'LANGUAGE',
    kind: 'open',
    rules: ['5개 단어를 모두 사용', '최대 200자'],
    rubric: ['단어 간 연결'],
    timeLimitSec: vi.fn(),
    evaluate: vi.fn(),
    buildAiPayload: vi.fn(),
  },
}))
vi.mock('./registry', () => ({ getActivity: (id: string) => (id === 'word-weave' ? fakeActivity : undefined) }))

const activity = fakeActivity as unknown as AnyActivity

const OUTPUT = { words: ['우산', '새벽'], text: '새벽 계단 아래' }
const META: FinishMeta = { elapsedMs: 64_400, timedOut: false, difficulty: 'normal' }
const FIXED_NOW = new Date('2026-11-15T12:00:00.000Z')

const PAYLOAD: AiActivityPayload = {
  activityId: 'word-weave',
  activityName: 'WORD WEAVE',
  category: 'LANGUAGE',
  kind: 'open',
  difficulty: 'normal',
  conditions: [],
  elapsedSec: 64,
  measured: { chars: 8 },
  userOutput: OUTPUT,
  rubric: [],
  knownReference: null,
}

let fake: FakeStorage
let calls: string[]

/** Real storage on a fake localStorage; navigation and ids are recorded/fixed. */
const realDeps = (over: Partial<FinishDeps> = {}): FinishDeps => ({
  saveSession: (r) => {
    calls.push('save')
    return saveSessionDetailed(r)
  },
  getAiConsent,
  navigate: (path) => calls.push(`navigate:${path}`),
  now: () => FIXED_NOW,
  uuid: () => 'run-1',
  ...over,
})

beforeEach(() => {
  calls = []
  fake = new FakeStorage()
  vi.stubGlobal('localStorage', fake)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  clearAll()
  fake.clear()
  fakeActivity.timeLimitSec.mockReset().mockReturnValue(90)
  fakeActivity.evaluate.mockReset().mockReturnValue({
    measured: { chars: 8, sentences: 1 },
    labels: [{ key: 'chars', label: '글자 수', unit: '자' }],
  })
  fakeActivity.buildAiPayload.mockReset().mockReturnValue(PAYLOAD)
  saveSettings({ schemaVersion: 1, aiConsent: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('finishRun: evaluate -> record -> save first -> navigate', () => {
  it('builds the SessionRecord from the activity, the output and the run meta', () => {
    const record = finishRun(activity, OUTPUT, META, realDeps())

    expect(record).toEqual({
      id: 'run-1',
      schemaVersion: 1,
      activityId: 'word-weave',
      category: 'LANGUAGE',
      kind: 'open',
      difficulty: 'normal',
      completedAt: '2026-11-15T12:00:00.000Z',
      conditions: ['5개 단어를 모두 사용', '최대 200자', '제한 시간 90초'],
      elapsedSec: 64, // 64.4s rounded
      timedOut: false,
      output: OUTPUT,
      measured: { chars: 8, sentences: 1 },
      labels: [{ key: 'chars', label: '글자 수', unit: '자' }],
      ai: { status: 'pending' },
    })
  })

  it('passes difficulty, elapsed time and timeout to evaluate()', () => {
    finishRun(activity, OUTPUT, { elapsedMs: 90_000, timedOut: true, difficulty: 'hard' }, realDeps())
    const [output, ctx] = fakeActivity.evaluate.mock.calls[0] as [unknown, EvalContext]
    expect(output).toEqual(OUTPUT)
    expect(ctx).toEqual({ difficulty: 'hard', elapsedMs: 90_000, timedOut: true })
    expect(fakeActivity.timeLimitSec).toHaveBeenCalledWith('hard')
  })

  it('records timeouts', () => {
    const record = finishRun(activity, OUTPUT, { ...META, timedOut: true }, realDeps())
    expect(record.timedOut).toBe(true)
  })

  it('saves the record before it navigates, to #/result/<id>', () => {
    finishRun(activity, OUTPUT, META, realDeps())
    expect(calls).toEqual(['save', 'navigate:/result/run-1'])
    expect(getSession('run-1')).toBeDefined() // already readable by the result screen
  })

  it.each([false, null])('stores ai.status "skipped" when consent is %s', (value) => {
    saveSettings({ schemaVersion: 1, aiConsent: value })
    expect(finishRun(activity, OUTPUT, META, realDeps()).ai).toEqual({ status: 'skipped' })
    expect(getSession('run-1')!.ai.status).toBe('skipped')
  })

  it('stores ai.status "pending" when consent is given', () => {
    expect(finishRun(activity, OUTPUT, META, realDeps()).ai).toEqual({ status: 'pending' })
  })

  it('still saves and navigates when evaluate() throws, logging the problem', () => {
    fakeActivity.evaluate.mockImplementation(() => {
      throw new Error('bug in activity')
    })
    const record = finishRun(activity, OUTPUT, META, realDeps())
    expect(record.measured).toEqual({})
    expect(record.labels).toEqual([])
    expect(record.output).toEqual(OUTPUT)
    expect(calls).toEqual(['save', 'navigate:/result/run-1'])
    expect(console.error).toHaveBeenCalled()
  })
})

describe('finishRun: storage failures', () => {
  it('reports a full storage, keeps the session usable in memory and still navigates', () => {
    const onStorageError = vi.fn()
    fake.failWrites = 'quota'
    finishRun(activity, OUTPUT, META, realDeps({ onStorageError }))

    expect(onStorageError).toHaveBeenCalledWith('quota')
    expect(calls).toEqual(['save', 'navigate:/result/run-1'])
    expect(getSession('run-1')).toBeDefined()
    expect(fake.getItem('skillmix:v1:sessions')).toBeNull()
  })

  it('reports "unavailable" for other storage failures', () => {
    const onStorageError = vi.fn()
    fake.failWrites = 'security'
    finishRun(activity, OUTPUT, META, realDeps({ onStorageError }))
    expect(onStorageError).toHaveBeenCalledWith('unavailable')
  })

  it('does not report anything when saving works', () => {
    const onStorageError = vi.fn()
    finishRun(activity, OUTPUT, META, realDeps({ onStorageError }))
    expect(onStorageError).not.toHaveBeenCalled()
  })
})

describe('mock mode, end to end: submit -> save -> ai field updated', () => {
  it('saves a pending session first, then requestAnalysis fills in the mock feedback', async () => {
    vi.useFakeTimers({ now: FIXED_NOW })
    vi.stubEnv('VITE_AI_MOCK', '1')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    // 1. submit: stored immediately as pending, then the result route is opened
    const record = finishRun(activity, OUTPUT, META, realDeps())
    expect(calls).toEqual(['save', 'navigate:/result/run-1'])
    expect(getSession(record.id)!.ai).toEqual({ status: 'pending' })

    // 2. RESULT entry: one analysis request
    const running = requestAnalysis(record.id)
    await vi.advanceTimersByTimeAsync(MOCK_DELAY_MS)
    expect(await running).toEqual({ state: 'completed' })

    // 3. only the ai field changed
    const after = getSession(record.id)!
    expect(after.ai).toMatchObject({ status: 'success', model: 'mock', feedback: MOCK_FEEDBACK })
    expect(after.ai.requestedAt).toBeDefined()
    expect(after.ai.respondedAt).toBeDefined()
    expect({ ...after, ai: undefined }).toEqual({ ...record, ai: undefined })
    expect(fetchSpy).not.toHaveBeenCalled() // mock mode never touches the network
    expect(getSessions()).toHaveLength(1)
  })

  it('without consent the same flow ends as skipped, with no analysis', async () => {
    vi.stubEnv('VITE_AI_MOCK', '1')
    saveSettings({ schemaVersion: 1, aiConsent: false })
    const record = finishRun(activity, OUTPUT, META, realDeps())
    expect(getSession(record.id)!.ai.status).toBe('skipped')
    expect(await requestAnalysis(record.id)).toEqual({ state: 'noop' })
  })
})
