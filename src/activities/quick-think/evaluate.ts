import type { EvalContext, Evaluation } from '../../types'
import { OPS, OP_LABEL } from './data'
import type { Op, ProblemResult } from './data'

export type Measured = Record<string, number | string | boolean>

const isOp = (v: unknown): v is Op => (OPS as readonly unknown[]).includes(v)

/** Accepts anything (a stage may submit null) and keeps only well-formed problem rows. */
export function normalizeProblems(output: unknown): ProblemResult[] {
  const list = typeof output === 'object' && output !== null ? (output as { problems?: unknown }).problems : undefined
  if (!Array.isArray(list)) return []
  return list.filter(
    (p): p is ProblemResult =>
      typeof p === 'object' &&
      p !== null &&
      typeof p.expr === 'string' &&
      isOp(p.op) &&
      typeof p.userAnswer === 'number' &&
      typeof p.answer === 'number' &&
      typeof p.correct === 'boolean' &&
      typeof p.ms === 'number' &&
      Number.isFinite(p.ms),
  )
}

const round1 = (n: number) => Math.round(n * 10) / 10
const sec = (ms: number) => round1(ms / 1000)
const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)

export function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Longest run of consecutive correct answers, in the order they were answered. */
export function longestStreak(problems: ProblemResult[]): number {
  let best = 0
  let run = 0
  for (const p of problems) {
    run = p.correct ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

/**
 * App-computed numbers (PRD 7.1). Pure and total: an empty or null output gives zeros and no
 * per-operator keys, never NaN. Operator keys exist only for operators that were attempted.
 */
export function evaluateQuickThink(output: unknown, _ctx?: EvalContext): Evaluation<Measured> {
  const problems = normalizeProblems(output)
  const attempts = problems.length
  const correctCount = problems.filter((p) => p.correct).length
  const times = problems.map((p) => p.ms)

  const measured: Measured = {
    attempts,
    correctCount,
    accuracyPct: attempts === 0 ? 0 : Math.round((correctCount / attempts) * 100),
    avgSec: sec(mean(times)),
    medianSec: sec(median(times)),
    maxStreak: longestStreak(problems),
    slowestSec: 0,
    slowestExpr: '',
  }

  if (attempts > 0) {
    const slowest = problems.reduce((a, b) => (b.ms > a.ms ? b : a))
    measured.slowestSec = sec(slowest.ms)
    measured.slowestExpr = slowest.expr
  }

  // Early vs late pace: needs at least one problem in each half.
  const firstCount = Math.ceil(attempts / 2)
  if (attempts >= 2) {
    measured.firstHalfAvgSec = sec(mean(times.slice(0, firstCount)))
    measured.secondHalfAvgSec = sec(mean(times.slice(firstCount)))
  }

  for (const op of OPS) {
    const rows = problems.filter((p) => p.op === op)
    if (rows.length === 0) continue
    measured[`n_${op}`] = rows.length
    measured[`acc_${op}`] = Math.round((rows.filter((p) => p.correct).length / rows.length) * 100)
  }

  const labels: Evaluation<Measured>['labels'] = [
    { key: 'attempts', label: '시도', unit: '문제' },
    { key: 'correctCount', label: '정답', unit: '문제' },
    { key: 'accuracyPct', label: '정확도', unit: '%' },
    { key: 'avgSec', label: '평균 응답 시간', unit: '초' },
    { key: 'medianSec', label: '중앙 응답 시간', unit: '초' },
    { key: 'maxStreak', label: '최대 연속 정답', unit: '문제' },
  ]
  if (attempts > 0) {
    labels.push({ key: 'slowestSec', label: '가장 오래 걸린 문제', unit: '초' })
    labels.push({ key: 'slowestExpr', label: '가장 오래 걸린 식' })
  }
  if ('firstHalfAvgSec' in measured) {
    labels.push({ key: 'firstHalfAvgSec', label: '전반 평균', unit: '초' })
    labels.push({ key: 'secondHalfAvgSec', label: '후반 평균', unit: '초' })
  }
  for (const op of OPS) {
    if (`acc_${op}` in measured) labels.push({ key: `acc_${op}`, label: `${OP_LABEL[op]} 정확도`, unit: '%' })
  }

  return { measured, labels }
}
