import { paths } from '../router'
import type { SaveOutcome } from '../lib/storage'
import type { EvalContext, Evaluation, SessionRecord, Difficulty } from '../types'
import type { AnyActivity } from './registry'

/** What ActivityShell reports when a run ends (submit, give up, or timeout). */
export interface FinishMeta {
  elapsedMs: number
  timedOut: boolean
  difficulty: Difficulty
}

export interface FinishDeps {
  saveSession: (record: SessionRecord) => SaveOutcome
  getAiConsent: () => boolean | null
  navigate: (path: string) => void
  now: () => Date
  uuid: () => string
  /** Called when the session could not be written to storage (it is kept in memory). */
  onStorageError?: (reason: 'quota' | 'unavailable') => void
}

/** Window event fired when saving fails; <StorageNotice> turns it into a toast. */
export const STORAGE_ERROR_EVENT = 'skillmix:storage-error'

const EMPTY_EVALUATION: Evaluation<Record<string, never>> = { measured: {}, labels: [] }

function evaluateSafely(activity: AnyActivity, output: unknown, ctx: EvalContext): Evaluation<unknown> {
  try {
    return activity.evaluate(output, ctx)
  } catch (e) {
    // The user's output is worth more than a missing metric: keep the run and log why.
    console.error(`[finishRun] ${activity.id}.evaluate failed; saving without measured values`, e)
    return EMPTY_EVALUATION as Evaluation<unknown>
  }
}

/**
 * PRD 9 save order: evaluate -> build the SessionRecord (ai.status = consent ? 'pending' : 'skipped')
 * -> save it FIRST -> go to the result screen. The AI call happens later, on RESULT entry.
 */
export function finishRun(activity: AnyActivity, output: unknown, meta: FinishMeta, deps: FinishDeps): SessionRecord {
  const evaluation = evaluateSafely(activity, output, {
    difficulty: meta.difficulty,
    elapsedMs: meta.elapsedMs,
    timedOut: meta.timedOut,
  })

  const consent = deps.getAiConsent() === true
  const record: SessionRecord = {
    id: deps.uuid(),
    schemaVersion: 1,
    activityId: activity.id,
    category: activity.category,
    kind: activity.kind,
    difficulty: meta.difficulty,
    completedAt: deps.now().toISOString(),
    conditions: [...activity.rules, `제한 시간 ${activity.timeLimitSec(meta.difficulty)}초`],
    elapsedSec: Math.round(meta.elapsedMs / 1000),
    timedOut: meta.timedOut,
    output,
    measured: evaluation.measured,
    labels: evaluation.labels as SessionRecord['labels'],
    ai: { status: consent ? 'pending' : 'skipped' },
  }

  const outcome = deps.saveSession(record)
  if (!outcome.ok) deps.onStorageError?.(outcome.reason)

  deps.navigate(paths.result(record.id))
  return record
}
