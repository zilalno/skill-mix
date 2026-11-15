import type { ActivityId, AiFeedback } from '../../src/types'
import { ACTIVITY_IDS, FEEDBACK } from './constants.js'

export type FeedbackResult = { ok: true; feedback: AiFeedback } | { ok: false; reason: string }

const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason })

/** Removes one surrounding ``` fence (with optional language tag). Anything else is left alone. */
export function stripCodeFence(raw: string): string {
  const text = raw.trim()
  const m = /^```[A-Za-z0-9_-]*[ \t]*\r?\n?([\s\S]*?)\r?\n?```$/.exec(text)
  return m ? m[1].trim() : text
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * The product is Korean-only. The default free model sometimes drifts into Chinese (or leaks a single
 * ideograph into a Korean sentence), so any Han, Hiragana or Katakana character in a field makes the answer invalid.
 */
export const FOREIGN_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u

const text = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= FEEDBACK.maxChars && !FOREIGN_SCRIPT.test(v)

/**
 * Validates an already-parsed object against PRD 8.4.
 * Missing or malformed fields are a failure: nothing is filled in with made-up text.
 * The one repair allowed is nextChallenge.activityId: a value outside the whitelist becomes null.
 */
export function validateFeedback(value: unknown): FeedbackResult {
  if (!isObject(value)) return fail('not an object')

  const { summary, observedPoints, strengths, improvementTip, nextChallenge } = value
  if (!text(summary)) return fail('summary')

  if (
    !Array.isArray(observedPoints) ||
    observedPoints.length < FEEDBACK.observedPoints.min ||
    observedPoints.length > FEEDBACK.observedPoints.max ||
    !observedPoints.every(text)
  ) {
    return fail('observedPoints')
  }

  if (
    !Array.isArray(strengths) ||
    strengths.length < FEEDBACK.strengths.min ||
    strengths.length > FEEDBACK.strengths.max
  ) {
    return fail('strengths')
  }
  const cleanStrengths: AiFeedback['strengths'] = []
  for (const s of strengths) {
    if (!isObject(s) || !text(s.point) || !text(s.evidence)) return fail('strengths item')
    cleanStrengths.push({ point: s.point, evidence: s.evidence })
  }

  if (!text(improvementTip)) return fail('improvementTip')

  if (!isObject(nextChallenge) || !text(nextChallenge.title) || !text(nextChallenge.reason)) {
    return fail('nextChallenge')
  }
  if (!('activityId' in nextChallenge)) return fail('nextChallenge.activityId')
  const id = nextChallenge.activityId
  const activityId: ActivityId | null =
    typeof id === 'string' && (ACTIVITY_IDS as string[]).includes(id) ? (id as ActivityId) : null

  return {
    ok: true,
    feedback: {
      summary,
      observedPoints: observedPoints as string[],
      strengths: cleanStrengths,
      improvementTip,
      nextChallenge: { title: nextChallenge.title, reason: nextChallenge.reason, activityId },
    },
  }
}

/** Model output text -> validated feedback. One parse attempt after removing a code fence. */
export function parseFeedback(raw: string): FeedbackResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripCodeFence(raw))
  } catch {
    return fail('not json')
  }
  return validateFeedback(parsed)
}
