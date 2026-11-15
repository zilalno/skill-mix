import type { EvalContext, Evaluation } from '../../types'
import type { PuzzleResult } from './data'

export type Measured = Record<string, number | string | boolean>

/** Accepts anything (a stage may submit null) and keeps only well-formed puzzle rows. */
export function normalizePuzzles(output: unknown): PuzzleResult[] {
  const list = typeof output === 'object' && output !== null ? (output as { puzzles?: unknown }).puzzles : undefined
  if (!Array.isArray(list)) return []
  return list.filter(
    (p): p is PuzzleResult =>
      typeof p === 'object' &&
      p !== null &&
      typeof p.id === 'string' &&
      typeof p.prompt === 'string' &&
      Array.isArray(p.choices) &&
      p.choices.every((c: unknown) => typeof c === 'string') &&
      (p.picked === null || (Number.isInteger(p.picked) && p.picked >= 0 && p.picked < p.choices.length)) &&
      typeof p.correct === 'boolean' &&
      typeof p.ms === 'number' &&
      Number.isFinite(p.ms) &&
      (p.ruleText === undefined || typeof p.ruleText === 'string'),
  )
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * App-computed numbers (PRD 7.2). Accuracy is correct answers out of ALL puzzles, so a skipped
 * puzzle counts against it; `answered` and `skipped` show the difference. Pure and total:
 * an empty or null output gives zeros, never NaN.
 */
export function evaluatePatternFind(output: unknown, _ctx?: EvalContext): Evaluation<Measured> {
  const puzzles = normalizePuzzles(output)
  const total = puzzles.length
  const correctCount = puzzles.filter((p) => p.correct).length
  const skipped = puzzles.filter((p) => p.picked === null).length
  const ruleCount = puzzles.filter((p) => (p.ruleText ?? '').trim() !== '').length
  const secs = puzzles.map((p) => p.ms / 1000)

  const measured: Measured = {
    total,
    answered: total - skipped,
    correctCount,
    accuracyPct: total === 0 ? 0 : Math.round((correctCount / total) * 100),
    skipped,
    ruleCount,
    avgSec: secs.length === 0 ? 0 : round1(secs.reduce((a, b) => a + b, 0) / secs.length),
    slowestSec: secs.length === 0 ? 0 : round1(Math.max(...secs)),
  }
  secs.forEach((s, i) => {
    measured[`t${i + 1}`] = round1(s)
  })

  const labels: Evaluation<Measured>['labels'] = [
    { key: 'correctCount', label: '정답', unit: '문제' },
    { key: 'accuracyPct', label: '정확도', unit: '%' },
    { key: 'skipped', label: '건너뜀', unit: '문제' },
    { key: 'ruleCount', label: '규칙 서술', unit: '개' },
    { key: 'avgSec', label: '평균 풀이 시간', unit: '초' },
    { key: 'slowestSec', label: '가장 오래 걸린 문제', unit: '초' },
  ]
  secs.forEach((_s, i) => labels.push({ key: `t${i + 1}`, label: `${i + 1}번 문제`, unit: '초' }))

  return { measured, labels }
}
