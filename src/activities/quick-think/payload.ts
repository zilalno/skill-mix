import type { AiActivityPayload, SessionCore } from '../../types'
import { normalizeProblems } from './evaluate'
import type { Measured } from './evaluate'
import type { ProblemResult, QuickThinkOutput } from './data'

export const RUBRIC = [
  '오답이 몰린 연산',
  '전반과 후반의 속도 변화',
  '속도와 정확도의 균형',
  '반복되는 실수 패턴',
]

/** The server accepts at most 60 array items; longer runs keep the first and last 30. */
export const MAX_ROWS = 60
const KEEP = MAX_ROWS / 2

/** One short line per problem, numbered so an analysis can cite "문제 7". */
export function problemRow(p: ProblemResult, n: number): string {
  const verdict = p.correct ? '정답' : `오답(정답 ${p.answer})`
  return `${n}. ${p.expr} = ${p.userAnswer} ${verdict} ${(p.ms / 1000).toFixed(1)}초`
}

/**
 * Only what the analysis needs (PRD 7.1): the measured numbers plus a compact problem list.
 * No personal data, no seed, no raw timestamps.
 */
export function buildQuickThinkPayload(s: SessionCore<QuickThinkOutput, Measured>): AiActivityPayload {
  const rows = normalizeProblems(s.output).map((p, i) => problemRow(p, i + 1))
  const omitted = Math.max(0, rows.length - MAX_ROWS)
  const shown = omitted > 0 ? [...rows.slice(0, KEEP), ...rows.slice(-KEEP)] : rows

  return {
    activityId: 'quick-think',
    activityName: 'QUICK THINK',
    category: 'CALC',
    kind: 'objective',
    difficulty: s.difficulty,
    conditions: s.conditions,
    elapsedSec: s.elapsedSec,
    measured: s.measured,
    userOutput: omitted > 0 ? { problems: shown, omittedMiddleProblems: omitted } : { problems: shown },
    rubric: RUBRIC,
    knownReference: null,
  }
}
