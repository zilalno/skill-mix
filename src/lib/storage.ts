// LocalStorage layer (PRD 9). Keys: `skillmix:v1:sessions`, `skillmix:v1:settings`.
import { ACTIVITY_IDS, DIFFICULTIES, KINDS } from '../../api/_lib/constants'
import type { SessionAi, SessionRecord } from '../types'

export const SESSIONS_KEY = 'skillmix:v1:sessions'
export const SETTINGS_KEY = 'skillmix:v1:settings'
/** A sessions blob that is not valid JSON is copied here before it can be overwritten. */
export const CORRUPT_BACKUP_PREFIX = 'skillmix:v1:sessions:corrupt:'
export const MAX_SESSIONS = 200

export interface Settings {
  schemaVersion: 1
  /** null = not asked yet; true/false = user's choice on the DISCOVER banner. */
  aiConsent: boolean | null
}

export type SaveOutcome = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' }

const AI_STATUSES = ['pending', 'success', 'failed', 'skipped']

/**
 * Sessions that could not be written (storage full or unavailable) live here for the rest of
 * the visit, so the RESULT screen still works. They win over stored copies with the same id.
 */
const memory = new Map<string, SessionRecord>()

let backupCounter = 0

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null // access itself can throw (SecurityError) in locked-down browsers
  }
}

function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error) && !isObject(e)) return false
  const err = e as { name?: unknown; code?: unknown }
  return err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014
}

export function isSessionRecord(x: unknown): x is SessionRecord {
  if (!isObject(x)) return false
  return (
    x.schemaVersion === 1 &&
    typeof x.id === 'string' &&
    x.id.length > 0 &&
    typeof x.activityId === 'string' &&
    (ACTIVITY_IDS as string[]).includes(x.activityId) &&
    typeof x.category === 'string' &&
    (KINDS as readonly unknown[]).includes(x.kind) &&
    (DIFFICULTIES as readonly unknown[]).includes(x.difficulty) &&
    typeof x.completedAt === 'string' &&
    !Number.isNaN(Date.parse(x.completedAt)) &&
    Array.isArray(x.conditions) &&
    x.conditions.every((c) => typeof c === 'string') &&
    typeof x.elapsedSec === 'number' &&
    Number.isFinite(x.elapsedSec) &&
    typeof x.timedOut === 'boolean' &&
    'output' in x &&
    'measured' in x &&
    Array.isArray(x.labels) &&
    isObject(x.ai) &&
    AI_STATUSES.includes(x.ai.status as string)
  )
}

interface RawRead {
  items: unknown[]
  /** Set when the stored text is not a JSON array: kept so it can be backed up before a write. */
  corruptedText: string | null
}

function readRaw(store: Storage): RawRead {
  let text: string | null
  try {
    text = store.getItem(SESSIONS_KEY)
  } catch {
    return { items: [], corruptedText: null }
  }
  if (text === null) return { items: [], corruptedText: null }
  try {
    const parsed: unknown = JSON.parse(text)
    if (Array.isArray(parsed)) return { items: parsed, corruptedText: null }
  } catch {
    // fall through to the corrupted case
  }
  console.warn('[storage] sessions data is corrupted; it is ignored and will be backed up before any write')
  return { items: [], corruptedText: text }
}

function writeItems(store: Storage, items: unknown[], corruptedText: string | null): SaveOutcome {
  try {
    if (corruptedText !== null) {
      // Never overwrite unreadable data without keeping a copy of it.
      store.setItem(`${CORRUPT_BACKUP_PREFIX}${Date.now()}-${backupCounter++}`, corruptedText)
    }
    store.setItem(SESSIONS_KEY, JSON.stringify(items))
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: isQuotaError(e) ? 'quota' : 'unavailable' }
  }
}

/** Valid sessions only; invalid entries are skipped with a warning and left in storage. */
function readValid(store: Storage | null): SessionRecord[] {
  const valid: SessionRecord[] = []
  if (store) {
    readRaw(store).items.forEach((item, index) => {
      if (isSessionRecord(item)) valid.push(item)
      else console.warn(`[storage] skipped an invalid session entry at index ${index} (kept in storage)`)
    })
  }
  return valid
}

/** All sessions, newest first. Unwritable (in-memory) sessions are included. */
export function getSessions(): SessionRecord[] {
  const byId = new Map<string, SessionRecord>()
  for (const s of readValid(getStorage())) byId.set(s.id, s)
  for (const s of memory.values()) byId.set(s.id, s)
  return [...byId.values()].sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0))
}

/** Kept for callers written against the original stub name. */
export const loadSessions = getSessions

export function getSession(id: string): SessionRecord | undefined {
  return getSessions().find((s) => s.id === id)
}

/**
 * Appends (or replaces, same id) a session and keeps at most MAX_SESSIONS valid ones, oldest
 * first out. Invalid entries are never trimmed. If the write fails the record is kept in memory
 * and the outcome says why, so the caller can show a "storage full" notice.
 */
export function saveSessionDetailed(record: SessionRecord): SaveOutcome {
  const store = getStorage()
  if (!store) {
    memory.set(record.id, record)
    return { ok: false, reason: 'unavailable' }
  }

  const { items, corruptedText } = readRaw(store)
  const next = [...items]
  const at = next.findIndex((it) => isObject(it) && it.id === record.id)
  if (at >= 0) next[at] = record
  else next.push(record)

  let validCount = next.filter(isSessionRecord).length
  while (validCount > MAX_SESSIONS) {
    const oldest = next.findIndex(isSessionRecord)
    next.splice(oldest, 1)
    validCount--
  }

  const outcome = writeItems(store, next, corruptedText)
  if (outcome.ok) memory.delete(record.id)
  else memory.set(record.id, record)
  return outcome
}

export function saveSession(record: SessionRecord): boolean {
  return saveSessionDetailed(record).ok
}

function applyPatch(ai: SessionAi, patch: Partial<SessionAi>): SessionAi {
  const merged: Record<string, unknown> = { ...ai }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete merged[key] // an explicit undefined clears the field
    else merged[key] = value
  }
  return merged as unknown as SessionAi
}

/**
 * Merges `aiPatch` into the `ai` field of one session. Nothing else on the record can change:
 * output, measured and labels are never touched. Returns false when the id is unknown.
 */
export function updateSessionAi(id: string, aiPatch: Partial<SessionAi>): boolean {
  const inMemory = memory.get(id)
  if (inMemory) {
    memory.set(id, { ...inMemory, ai: applyPatch(inMemory.ai, aiPatch) })
    return true
  }

  const store = getStorage()
  if (!store) return false
  const { items, corruptedText } = readRaw(store)
  const at = items.findIndex((it) => isSessionRecord(it) && it.id === id)
  if (at < 0) return false

  const current = items[at] as SessionRecord
  const updated: SessionRecord = { ...current, ai: applyPatch(current.ai, aiPatch) }
  const next = [...items]
  next[at] = updated
  if (writeItems(store, next, corruptedText).ok) return true

  memory.set(id, updated) // could not persist: keep the change for this visit
  return true
}

export function deleteSession(id: string): boolean {
  const hadMemory = memory.delete(id)
  const store = getStorage()
  if (!store) return hadMemory
  const { items, corruptedText } = readRaw(store)
  const next = items.filter((it) => !(isObject(it) && it.id === id))
  if (next.length === items.length) return hadMemory
  return writeItems(store, next, corruptedText).ok || hadMemory
}

/** User-initiated wipe of everything this app stores (sessions, settings, corruption backups). */
export function clearAll(): void {
  memory.clear()
  const store = getStorage()
  if (!store) return
  try {
    const stale: string[] = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key && key.startsWith(CORRUPT_BACKUP_PREFIX)) stale.push(key)
    }
    for (const key of [SESSIONS_KEY, SETTINGS_KEY, ...stale]) store.removeItem(key)
  } catch {
    console.warn('[storage] clearAll could not remove every key')
  }
}

// ---- Settings ---------------------------------------------------------------

const DEFAULT_SETTINGS: Settings = { schemaVersion: 1, aiConsent: null }

/** Never throws: missing, unreadable or invalid settings read as "not asked yet". */
export function loadSettings(): Settings {
  const store = getStorage()
  if (!store) return { ...DEFAULT_SETTINGS }
  try {
    const text = store.getItem(SETTINGS_KEY)
    if (text === null) return { ...DEFAULT_SETTINGS }
    const parsed: unknown = JSON.parse(text)
    if (isObject(parsed) && parsed.schemaVersion === 1 && (parsed.aiConsent === null || typeof parsed.aiConsent === 'boolean')) {
      return { schemaVersion: 1, aiConsent: parsed.aiConsent }
    }
  } catch {
    // fall through to the default
  }
  return { ...DEFAULT_SETTINGS }
}

/** Returns false (never throws) when the write fails. */
export function saveSettings(settings: Settings): boolean {
  const store = getStorage()
  if (!store) return false
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify({ schemaVersion: 1, aiConsent: settings.aiConsent }))
    return true
  } catch {
    return false
  }
}

export function getAiConsent(): boolean | null {
  return loadSettings().aiConsent
}
