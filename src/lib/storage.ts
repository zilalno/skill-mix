// LocalStorage layer (PRD 9). Keys: `skillmix:v1:sessions`, `skillmix:v1:settings`.
// Signatures are the shared contract; bodies are TODO.
import type { SessionAi, SessionRecord } from '../types'

export interface Settings {
  schemaVersion: 1
  /** null = not asked yet; true/false = user's choice on the DISCOVER banner. */
  aiConsent: boolean | null
}

/** Newest first. Skips entries that fail schema validation (console.warn, never deletes). */
export function loadSessions(): SessionRecord[] {
  throw new Error('TODO: loadSessions')
}

export function getSession(_id: string): SessionRecord | undefined {
  throw new Error('TODO: getSession')
}

/** Appends a record; keeps at most 200 (drops oldest). Handles QuotaExceededError. Returns false if it could not persist. */
export function saveSession(_record: SessionRecord): boolean {
  throw new Error('TODO: saveSession')
}

/** Replaces only the `ai` field of the session with this id; output/measured stay untouched. */
export function updateSessionAi(_id: string, _ai: SessionAi): void {
  throw new Error('TODO: updateSessionAi')
}

export function loadSettings(): Settings {
  throw new Error('TODO: loadSettings')
}

export function saveSettings(_settings: Settings): void {
  throw new Error('TODO: saveSettings')
}
