// Shared contracts (PRD 8.2, 8.3, 8.4, 9). Changes require agreement between both developers.
import type { ComponentType } from 'react'

export type ActivityId = 'quick-think' | 'pattern-find' | 'word-weave' | 'shape-mix'
export type ActivityKind = 'objective' | 'hybrid' | 'open'
export type Difficulty = 'easy' | 'normal' | 'hard'

// ---- 8.2 Activity contract -------------------------------------------------

export interface StageProps<O> {
  difficulty: Difficulty
  remainingMs: number
  onSubmit: (output: O, meta: { elapsedMs: number; timedOut: boolean }) => void
}

export interface Evaluation<M> {
  measured: M // numbers/booleans computed by the app
  labels: { key: keyof M; label: string; unit?: string }[] // chips on RESULT
}

/** Input to evaluate(). PRD names EvalContext but does not define it; minimal shape. */
export interface EvalContext {
  difficulty: Difficulty
  elapsedMs: number
  timedOut: boolean
}

/** What buildAiPayload() receives. PRD names SessionCore but does not define it;
 *  it is the subset of SessionRecord that exists before the AI call. */
export interface SessionCore<O, M> {
  id: string
  activityId: ActivityId
  difficulty: Difficulty
  conditions: string[]
  elapsedSec: number
  timedOut: boolean
  output: O
  measured: M
}

export interface ActivityDefinition<O = unknown, M = Record<string, number | string | boolean>> {
  id: ActivityId
  name: string // 'WORD WEAVE'
  category: string // 'LANGUAGE'
  kind: ActivityKind
  tagline: string // one line for the card
  rules: string[] // INTRO screen rules
  estMinutes: number
  timeLimitSec: (d: Difficulty) => number
  accent: string // CSS variable name, per-activity colour
  Stage: ComponentType<StageProps<O>>
  evaluate: (output: O, ctx: EvalContext) => Evaluation<M> // pure function (tested)
  buildAiPayload: (s: SessionCore<O, M>) => AiActivityPayload // only the data needed
  rubric: string[] // criteria sent to the AI
  nextSuggestions: ActivityId[]
}

// ---- 8.3 AI request (client -> POST /api/analyze) --------------------------

export interface AiActivityPayload {
  activityId: ActivityId
  activityName: string
  category: string
  kind: ActivityKind
  difficulty: Difficulty
  conditions: string[]
  elapsedSec: number
  measured: Record<string, number | string | boolean>
  userOutput: unknown
  rubric: string[]
  knownReference: unknown | null // e.g. PATTERN FIND intendedRule/distractorNote
}

// ---- 8.4 AI response (validated by the server) -----------------------------

export interface AiFeedback {
  summary: string // 1-2 sentences
  observedPoints: string[] // 2-4 items
  strengths: { point: string; evidence: string }[] // 1-3 items
  improvementTip: string
  nextChallenge: { title: string; reason: string; activityId: ActivityId | null }
}

// ---- 9. Stored session -----------------------------------------------------

export type AiStatus = 'pending' | 'success' | 'failed' | 'skipped'
export type AiErrorCode = 'timeout' | 'network' | 'invalid_format' | 'upstream' | 'rate_limit'

export interface SessionAi {
  status: AiStatus
  model?: string // actual model name at response time
  requestedAt?: string // ISO
  respondedAt?: string // ISO
  feedback?: AiFeedback
  errorCode?: AiErrorCode
}

export interface SessionRecord<O = unknown, M = unknown> {
  id: string // crypto.randomUUID()
  schemaVersion: 1
  activityId: ActivityId
  category: string
  kind: ActivityKind
  difficulty: Difficulty
  completedAt: string // ISO
  conditions: string[]
  elapsedSec: number
  timedOut: boolean
  output: O // the user's actual submission (per-activity shape)
  measured: M // app-computed metrics
  labels: Evaluation<M>['labels']
  ai: SessionAi
}
