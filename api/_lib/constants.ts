import type { ActivityId, ActivityKind, Difficulty } from '../../src/types'

// Server-side limits and whitelists (PRD 8.3, 8.4, 11.2, 11.3).
export const MAX_BODY_BYTES = 8 * 1024
export const UPSTREAM_TIMEOUT_MS = 25_000
export const MAX_TOKENS = 700
/** A malformed/off-language answer is retried (up to this many calls in total) while another call still fits the time budget. */
export const MAX_ATTEMPTS = 3
/** Safety margin kept free below UPSTREAM_TIMEOUT_MS when deciding whether one more call fits. */
export const RETRY_MARGIN_MS = 1_500
export const TEMPERATURE = 0.5
/**
 * The default free model is a reasoning model: with thinking on it spends 500-800 tokens before the
 * answer, which exhausts MAX_TOKENS (content comes back null) and adds ~8s. We ask for no reasoning.
 * Models without such a switch ignore the field.
 */
export const REASONING = { enabled: false } as const
export const DEFAULT_MODEL = 'dots-studio/dots-3-note-preview:free'
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** Canonical per-activity facts. The server never trusts the client's copies of these. */
export const ACTIVITY_META = {
  'quick-think': { name: 'QUICK THINK', category: 'CALC', kind: 'objective' },
  'pattern-find': { name: 'PATTERN FIND', category: 'LOGIC', kind: 'hybrid' },
  'word-weave': { name: 'WORD WEAVE', category: 'LANGUAGE', kind: 'open' },
  'shape-mix': { name: 'SHAPE MIX', category: 'SPATIAL', kind: 'open' },
} as const satisfies Record<ActivityId, { name: string; category: string; kind: ActivityKind }>

export const ACTIVITY_IDS = Object.keys(ACTIVITY_META) as ActivityId[]
export const KINDS: readonly ActivityKind[] = ['objective', 'hybrid', 'open']
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard']

/** Request field limits (string length caps etc.). */
export const LIMITS = {
  shortString: 40, // activityName, category, kind echoes
  conditionItems: 8,
  conditionChars: 200,
  rubricItems: 8,
  rubricChars: 120,
  measuredKeys: 24,
  measuredStringChars: 200,
  keyChars: 40,
  jsonStringChars: 1500,
  jsonArrayItems: 60,
  jsonObjectKeys: 30,
  jsonDepth: 5,
  jsonNodes: 400,
  maxElapsedSec: 86_400,
} as const

/** AI response limits (PRD 8.4). */
export const FEEDBACK = {
  maxChars: 300,
  observedPoints: { min: 2, max: 4 },
  strengths: { min: 1, max: 3 },
} as const
