import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRecord } from '../types'
import {
  CORRUPT_BACKUP_PREFIX,
  MAX_SESSIONS,
  SESSIONS_KEY,
  SETTINGS_KEY,
  clearAll,
  deleteSession,
  getAiConsent,
  getSession,
  getSessions,
  loadSettings,
  saveSession,
  saveSessionDetailed,
  saveSettings,
  updateSessionAi,
} from './storage'
import { FakeStorage } from './testing/fakeStorage'

const make = (id: string, completedAt = '2026-11-15T10:00:00.000Z', over: Partial<SessionRecord> = {}): SessionRecord => ({
  id,
  schemaVersion: 1,
  activityId: 'word-weave',
  category: 'LANGUAGE',
  kind: 'open',
  difficulty: 'normal',
  completedAt,
  conditions: ['5개 단어를 모두 사용'],
  elapsedSec: 60,
  timedOut: false,
  output: { text: '새벽 계단 아래' },
  measured: { chars: 8, sentences: 1 },
  labels: [],
  ai: { status: 'pending' },
  ...over,
})

const at = (i: number) => new Date(Date.UTC(2026, 10, 15, 0, 0, i)).toISOString()
const rawSessions = (fake: FakeStorage) => JSON.parse(fake.getItem(SESSIONS_KEY) ?? 'null') as unknown[]

let fake: FakeStorage
let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fake = new FakeStorage()
  vi.stubGlobal('localStorage', fake)
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  clearAll() // also resets the module's in-memory fallback between tests
  fake.clear()
})

afterEach(() => {
  warn.mockRestore()
  vi.unstubAllGlobals()
})

describe('keys and schema', () => {
  it('writes a JSON array under skillmix:v1:sessions with schemaVersion 1', () => {
    expect(saveSession(make('a'))).toBe(true)
    expect(SESSIONS_KEY).toBe('skillmix:v1:sessions')
    expect(SETTINGS_KEY).toBe('skillmix:v1:settings')
    const raw = rawSessions(fake) as SessionRecord[]
    expect(Array.isArray(raw)).toBe(true)
    expect(raw[0].id).toBe('a')
    expect(raw[0].schemaVersion).toBe(1)
  })
})

describe('save / get', () => {
  it('round-trips a session', () => {
    const s = make('a')
    saveSession(s)
    expect(getSession('a')).toEqual(s)
  })

  it('returns sessions newest first', () => {
    saveSession(make('old', at(1)))
    saveSession(make('new', at(3)))
    saveSession(make('mid', at(2)))
    expect(getSessions().map((s) => s.id)).toEqual(['new', 'mid', 'old'])
  })

  it('returns undefined for an unknown id and [] when empty', () => {
    expect(getSession('nope')).toBeUndefined()
    expect(getSessions()).toEqual([])
  })

  it('replaces a session saved again with the same id instead of duplicating it', () => {
    saveSession(make('a', at(1), { elapsedSec: 10 }))
    saveSession(make('a', at(1), { elapsedSec: 99 }))
    expect(getSessions()).toHaveLength(1)
    expect(getSession('a')?.elapsedSec).toBe(99)
  })
})

describe('updateSessionAi', () => {
  it('merges the patch into ai and leaves output, measured and everything else unchanged', () => {
    const original = make('a', at(1), { ai: { status: 'pending', requestedAt: '2026-11-15T10:00:01.000Z' } })
    saveSession(original)
    saveSession(make('b', at(2)))

    const ok = updateSessionAi('a', { status: 'success', model: 'm/x:free', respondedAt: '2026-11-15T10:00:05.000Z' })
    expect(ok).toBe(true)

    const after = getSession('a')!
    expect(after.ai).toEqual({
      status: 'success',
      requestedAt: '2026-11-15T10:00:01.000Z', // kept from before: it is a merge
      model: 'm/x:free',
      respondedAt: '2026-11-15T10:00:05.000Z',
    })
    expect({ ...after, ai: undefined }).toEqual({ ...original, ai: undefined })
    expect(getSession('b')).toEqual(make('b', at(2)))
  })

  it('cannot reach top-level fields even if the patch carries extra keys', () => {
    saveSession(make('a'))
    updateSessionAi('a', { output: 'HACKED', measured: 'HACKED', id: 'x' } as never)
    const s = getSession('a')!
    expect(s.output).toEqual({ text: '새벽 계단 아래' })
    expect(s.measured).toEqual({ chars: 8, sentences: 1 })
    expect(s.id).toBe('a')
  })

  it('clears a field when the patch sets it to undefined', () => {
    saveSession(make('a', at(1), { ai: { status: 'failed', errorCode: 'timeout' } }))
    updateSessionAi('a', { status: 'pending', errorCode: undefined })
    expect(getSession('a')!.ai).toEqual({ status: 'pending' })
    expect('errorCode' in getSession('a')!.ai).toBe(false)
  })

  it('returns false for an unknown id and writes nothing', () => {
    saveSession(make('a'))
    const before = fake.getItem(SESSIONS_KEY)
    expect(updateSessionAi('missing', { status: 'success' })).toBe(false)
    expect(fake.getItem(SESSIONS_KEY)).toBe(before)
  })
})

describe('deleteSession / clearAll', () => {
  it('deletes one session and reports whether it existed', () => {
    saveSession(make('a', at(1)))
    saveSession(make('b', at(2)))
    expect(deleteSession('a')).toBe(true)
    expect(getSessions().map((s) => s.id)).toEqual(['b'])
    expect(deleteSession('a')).toBe(false)
  })

  it('clearAll removes sessions, settings and corruption backups but not foreign keys', () => {
    saveSession(make('a'))
    saveSettings({ schemaVersion: 1, aiConsent: true })
    fake.setItem(`${CORRUPT_BACKUP_PREFIX}123`, '{broken')
    fake.setItem('some:other:app', 'keep me')

    clearAll()

    expect(fake.keys()).toEqual(['some:other:app'])
    expect(getSessions()).toEqual([])
    expect(loadSettings().aiConsent).toBeNull()
  })
})

describe('200-session cap', () => {
  it('keeps the newest 200 and drops the oldest first', () => {
    for (let i = 0; i < MAX_SESSIONS + 5; i++) saveSession(make(`s${i}`, at(i)))
    const ids = getSessions().map((s) => s.id)
    expect(MAX_SESSIONS).toBe(200)
    expect(ids).toHaveLength(200)
    for (let i = 0; i < 5; i++) expect(ids).not.toContain(`s${i}`)
    expect(ids).toContain('s5')
    expect(ids).toContain('s204')
  })

  it('does not count or trim invalid entries', () => {
    const junk = [{ bad: 1 }, 'text']
    fake.setItem(SESSIONS_KEY, JSON.stringify(junk))
    for (let i = 0; i < MAX_SESSIONS + 2; i++) saveSession(make(`s${i}`, at(i)))
    const raw = rawSessions(fake)
    expect(raw).toContainEqual({ bad: 1 })
    expect(raw).toContain('text')
    expect(getSessions()).toHaveLength(200)
  })
})

describe('QuotaExceededError and unavailable storage', () => {
  it('does not throw on quota errors, reports them, and keeps the session usable in memory', () => {
    fake.failWrites = 'quota'
    const outcome = saveSessionDetailed(make('a'))
    expect(outcome).toEqual({ ok: false, reason: 'quota' })
    expect(saveSession(make('b'))).toBe(false)

    expect(getSession('a')).toBeDefined() // RESULT can still render it
    expect(updateSessionAi('a', { status: 'success' })).toBe(true)
    expect(getSession('a')!.ai.status).toBe('success')
    expect(fake.getItem(SESSIONS_KEY)).toBeNull() // nothing was half-written
  })

  it('persists a memory-held session once storage works again', () => {
    fake.failWrites = 'quota'
    saveSession(make('a'))
    fake.failWrites = null
    expect(saveSession(make('a'))).toBe(true)
    expect(rawSessions(fake)).toHaveLength(1)
    expect(getSessions()).toHaveLength(1)
  })

  it('reports quota when the store fills up by size', () => {
    fake.maxChars = 300
    expect(saveSessionDetailed(make('a')).ok).toBe(false)
  })

  it('reports "unavailable" for other storage errors', () => {
    fake.failWrites = 'security'
    expect(saveSessionDetailed(make('a'))).toEqual({ ok: false, reason: 'unavailable' })
    expect(getSession('a')).toBeDefined()
  })

  it('keeps working in memory when localStorage does not exist at all', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(saveSessionDetailed(make('a'))).toEqual({ ok: false, reason: 'unavailable' })
    expect(getSession('a')).toBeDefined()
    expect(loadSettings()).toEqual({ schemaVersion: 1, aiConsent: null })
    expect(saveSettings({ schemaVersion: 1, aiConsent: true })).toBe(false)
  })

  it('survives a localStorage getter that throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError')
      },
    })
    expect(() => getSessions()).not.toThrow()
    expect(saveSession(make('a'))).toBe(false)
    expect(getSession('a')).toBeDefined()
  })
})

describe('corrupted data', () => {
  const good = (id: string, i: number) => make(id, at(i))

  it('skips invalid entries when reading, with a warning, and does not delete them', () => {
    const v2 = { ...good('v2', 9), schemaVersion: 2 }
    const items = [good('a', 1), { bad: true }, 'a string', null, v2, { ...good('x', 5), ai: { status: 'weird' } }, good('b', 2)]
    fake.setItem(SESSIONS_KEY, JSON.stringify(items))

    expect(getSessions().map((s) => s.id)).toEqual(['b', 'a'])
    expect(warn).toHaveBeenCalled()
    expect(rawSessions(fake)).toEqual(items) // reading changes nothing on disk
  })

  it('keeps invalid entries through save, update and delete', () => {
    const v2 = { ...good('v2', 9), schemaVersion: 2 }
    const junk = [{ bad: true }, 'a string', v2]
    fake.setItem(SESSIONS_KEY, JSON.stringify([good('a', 1), ...junk]))

    saveSession(good('new', 3))
    updateSessionAi('a', { status: 'success' })
    deleteSession('new')

    const raw = rawSessions(fake)
    for (const item of junk) expect(raw).toContainEqual(item)
    expect(getSessions().map((s) => s.id)).toEqual(['a'])
  })

  it('treats unparseable JSON as empty without throwing', () => {
    fake.setItem(SESSIONS_KEY, '{not json')
    expect(() => getSessions()).not.toThrow()
    expect(getSessions()).toEqual([])
    expect(getSession('a')).toBeUndefined()
    expect(updateSessionAi('a', { status: 'success' })).toBe(false)
    expect(fake.getItem(SESSIONS_KEY)).toBe('{not json') // reads never overwrite
  })

  it('treats a non-array JSON value as corrupted too', () => {
    fake.setItem(SESSIONS_KEY, '{"a":1}')
    expect(getSessions()).toEqual([])
    saveSession(make('a'))
    expect(fake.keys().some((k) => k.startsWith(CORRUPT_BACKUP_PREFIX))).toBe(true)
  })

  it('backs the unreadable blob up before the first write replaces it', () => {
    fake.setItem(SESSIONS_KEY, '{not json')
    expect(saveSession(make('a'))).toBe(true)

    const backups = fake.keys().filter((k) => k.startsWith(CORRUPT_BACKUP_PREFIX))
    expect(backups).toHaveLength(1)
    expect(fake.getItem(backups[0])).toBe('{not json')
    expect(getSessions().map((s) => s.id)).toEqual(['a'])
  })

  it('does not overwrite the unreadable blob when the backup cannot be written', () => {
    fake.setItem(SESSIONS_KEY, '{not json')
    fake.failWrites = 'quota'
    expect(saveSession(make('a'))).toBe(false)
    expect(fake.getItem(SESSIONS_KEY)).toBe('{not json')
    expect(getSession('a')).toBeDefined() // still usable from memory
  })
})

describe('settings (AI consent)', () => {
  it('defaults to "not asked yet"', () => {
    expect(loadSettings()).toEqual({ schemaVersion: 1, aiConsent: null })
    expect(getAiConsent()).toBeNull()
  })

  it('round-trips true and false under skillmix:v1:settings with a schemaVersion', () => {
    expect(saveSettings({ schemaVersion: 1, aiConsent: true })).toBe(true)
    expect(JSON.parse(fake.getItem(SETTINGS_KEY)!)).toEqual({ schemaVersion: 1, aiConsent: true })
    expect(getAiConsent()).toBe(true)
    saveSettings({ schemaVersion: 1, aiConsent: false })
    expect(getAiConsent()).toBe(false)
  })

  it('falls back to the default for broken or foreign settings data', () => {
    for (const bad of ['{nope', '"string"', '[]', '{"schemaVersion":2,"aiConsent":true}', '{"schemaVersion":1,"aiConsent":"yes"}']) {
      fake.setItem(SETTINGS_KEY, bad)
      expect(loadSettings()).toEqual({ schemaVersion: 1, aiConsent: null })
    }
  })

  it('returns false instead of throwing when the write fails', () => {
    fake.failWrites = 'quota'
    expect(saveSettings({ schemaVersion: 1, aiConsent: true })).toBe(false)
  })
})
