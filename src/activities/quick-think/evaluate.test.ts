import { describe, expect, it } from 'vitest'
import { validateAnalyzeRequest } from '../../../api/_lib/validate'
import type { SessionCore } from '../../types'
import type { ProblemResult } from './data'
import { evaluateQuickThink, longestStreak, median } from './evaluate'
import type { Measured } from './evaluate'
import { quickThink } from './index'
import { MAX_ROWS, buildQuickThinkPayload, problemRow } from './payload'

const p = (over: Partial<ProblemResult> = {}): ProblemResult => ({
  expr: '1 + 1',
  op: 'add',
  userAnswer: 2,
  answer: 2,
  correct: true,
  ms: 1000,
  ...over,
})

const measuredOf = (output: unknown) => evaluateQuickThink(output).measured

describe('median / longestStreak', () => {
  it('median of odd, even and empty lists', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBe(0)
  })

  it('longestStreak counts the longest run of correct answers in order', () => {
    const run = (flags: boolean[]) => longestStreak(flags.map((correct) => p({ correct })))
    expect(run([])).toBe(0)
    expect(run([false, false])).toBe(0)
    expect(run([true, true, false, true, true, true, false])).toBe(3)
    expect(run([true, true, true])).toBe(3)
  })
})

describe('evaluateQuickThink: empty and broken input', () => {
  it.each([
    ['no problems', { problems: [] }],
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
    ['problems is not an array', { problems: 'x' }],
    ['a number', 7],
  ])('gives clean zeros for %s', (_name, output) => {
    const { measured, labels } = evaluateQuickThink(output)
    expect(measured).toEqual({
      attempts: 0,
      correctCount: 0,
      accuracyPct: 0,
      avgSec: 0,
      medianSec: 0,
      maxStreak: 0,
      slowestSec: 0,
      slowestExpr: '',
    })
    for (const v of Object.values(measured)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
    expect(labels.map((l) => l.key)).toEqual(['attempts', 'correctCount', 'accuracyPct', 'avgSec', 'medianSec', 'maxStreak'])
  })

  it('ignores malformed rows and keeps the good ones', () => {
    const m = measuredOf({ problems: [p(), { expr: 1 }, null, 'x', p({ ms: Number.NaN }), p({ correct: false })] })
    expect(m.attempts).toBe(2)
    expect(m.correctCount).toBe(1)
  })
})

describe('evaluateQuickThink: one problem', () => {
  it('has no per-half pace and uses the single time everywhere', () => {
    const m = measuredOf({ problems: [p({ ms: 2400, expr: '7 × 8', op: 'mul' })] })
    expect(m).toMatchObject({
      attempts: 1,
      correctCount: 1,
      accuracyPct: 100,
      avgSec: 2.4,
      medianSec: 2.4,
      slowestSec: 2.4,
      slowestExpr: '7 × 8',
      maxStreak: 1,
      n_mul: 1,
      acc_mul: 100,
    })
    expect('firstHalfAvgSec' in m).toBe(false)
  })
})

describe('evaluateQuickThink: a known run', () => {
  const output = {
    problems: [
      p({ op: 'add', expr: '10 + 20', ms: 2000 }),
      p({ op: 'sub', expr: '90 − 30', ms: 4000 }),
      p({ op: 'mul', expr: '6 × 7', ms: 1000, correct: false, userAnswer: 41, answer: 42 }),
      p({ op: 'add', expr: '33 + 44', ms: 3000 }),
      p({ op: 'mul', expr: '12 × 4', ms: 5000 }),
      p({ op: 'div', expr: '84 ÷ 7', ms: 2000 }),
    ],
  }
  const { measured, labels } = evaluateQuickThink(output)

  it('counts attempts, correct answers and accuracy', () => {
    expect(measured.attempts).toBe(6)
    expect(measured.correctCount).toBe(5)
    expect(measured.accuracyPct).toBe(83)
  })

  it('computes mean and median response time', () => {
    expect(measured.avgSec).toBe(2.8) // 17000 / 6 = 2833 ms
    expect(measured.medianSec).toBe(2.5) // middle of 2000 and 3000
  })

  it('finds the slowest problem', () => {
    expect(measured.slowestSec).toBe(5)
    expect(measured.slowestExpr).toBe('12 × 4')
  })

  it('finds the longest correct streak (T T F T T T)', () => {
    expect(measured.maxStreak).toBe(3)
  })

  it('compares the first and second half', () => {
    expect(measured.firstHalfAvgSec).toBe(2.3) // 2000, 4000, 1000
    expect(measured.secondHalfAvgSec).toBe(3.3) // 3000, 5000, 2000
  })

  it('reports accuracy per operator, only for operators that were attempted', () => {
    expect(measured).toMatchObject({ n_add: 2, acc_add: 100, n_sub: 1, acc_sub: 100, n_mul: 2, acc_mul: 50, n_div: 1, acc_div: 100 })
    expect('acc_paren' in measured).toBe(false)
  })

  it('has a label for every key it advertises, with units', () => {
    const keys = labels.map((l) => l.key)
    expect(keys).toEqual(
      expect.arrayContaining(['attempts', 'correctCount', 'accuracyPct', 'avgSec', 'medianSec', 'maxStreak', 'slowestSec', 'slowestExpr', 'firstHalfAvgSec', 'acc_add', 'acc_mul', 'acc_div']),
    )
    for (const l of labels) expect(l.key in measured).toBe(true)
    expect(labels.find((l) => l.key === 'accuracyPct')).toMatchObject({ label: '정확도', unit: '%' })
  })

  it('rounds accuracy to whole percent', () => {
    expect(measuredOf({ problems: [p(), p(), p({ correct: false })] }).accuracyPct).toBe(67)
  })

  it('takes the first of equally slow problems', () => {
    const m = measuredOf({ problems: [p({ expr: 'A', ms: 3000 }), p({ expr: 'B', ms: 3000 })] })
    expect(m.slowestExpr).toBe('A')
  })
})

// ---- AI payload ----

const core = (problems: ProblemResult[], over: Partial<SessionCore<{ problems: ProblemResult[] }, Measured>> = {}) => {
  const output = { problems }
  return {
    id: 's1',
    activityId: 'quick-think',
    difficulty: 'normal',
    conditions: [...quickThink.rules, '제한 시간 60초'],
    elapsedSec: 60,
    timedOut: true,
    output,
    measured: evaluateQuickThink(output).measured,
    ...over,
  } as SessionCore<{ problems: ProblemResult[] }, Measured>
}

const many = (n: number): ProblemResult[] =>
  Array.from({ length: n }, (_, i) => p({ expr: `${i} + 1`, userAnswer: i + 1, answer: i + 1, ms: 1500 + i }))

describe('problemRow', () => {
  it('writes a short numbered line a person can cite', () => {
    expect(problemRow(p({ expr: '47 + 38', userAnswer: 85, answer: 85, ms: 2140 }), 1)).toBe('1. 47 + 38 = 85 정답 2.1초')
  })
  it('puts the right answer into a wrong line', () => {
    expect(problemRow(p({ expr: '91 − 28', userAnswer: 62, answer: 63, correct: false, ms: 4800 }), 2)).toBe(
      '2. 91 − 28 = 62 오답(정답 63) 4.8초',
    )
  })
})

describe('buildQuickThinkPayload', () => {
  it('sends the measured numbers and a compact problem list, nothing else', () => {
    const payload = buildQuickThinkPayload(core(many(3)))
    expect(payload).toMatchObject({
      activityId: 'quick-think',
      activityName: 'QUICK THINK',
      category: 'CALC',
      kind: 'objective',
      difficulty: 'normal',
      elapsedSec: 60,
      knownReference: null,
    })
    expect(payload.userOutput).toEqual({
      problems: ['1. 0 + 1 = 1 정답 1.5초', '2. 1 + 1 = 2 정답 1.5초', '3. 2 + 1 = 3 정답 1.5초'],
    })
    expect(payload.measured).toEqual(evaluateQuickThink({ problems: many(3) }).measured)
    expect(payload.rubric).toEqual(quickThink.rubric)
    expect(Object.keys(payload).sort()).toEqual(
      ['activityId', 'activityName', 'category', 'conditions', 'difficulty', 'elapsedSec', 'kind', 'knownReference', 'measured', 'rubric', 'userOutput'],
    )
  })

  it('handles a run with no problems', () => {
    const payload = buildQuickThinkPayload(core([]))
    expect(payload.userOutput).toEqual({ problems: [] })
  })

  it('keeps the first and last 30 rows when a run is very long, and says how many were left out', () => {
    const payload = buildQuickThinkPayload(core(many(200)))
    const out = payload.userOutput as { problems: string[]; omittedMiddleProblems: number }
    expect(out.problems).toHaveLength(MAX_ROWS)
    expect(out.omittedMiddleProblems).toBe(140)
    expect(out.problems[0].startsWith('1. ')).toBe(true)
    expect(out.problems[29].startsWith('30. ')).toBe(true)
    expect(out.problems[30].startsWith('171. ')).toBe(true)
    expect(out.problems[59].startsWith('200. ')).toBe(true)
  })

  it.each([0, 1, 25, 60, 61, 200])('passes the server whitelist and stays under 8KB for %i problems', (n) => {
    const payload = buildQuickThinkPayload(core(many(n)))
    const checked = validateAnalyzeRequest(payload)
    expect(checked.ok).toBe(true)
    expect(JSON.stringify(payload).length).toBeLessThan(8 * 1024)
  })

  it('keeps measured within the server limits even when every operator was used', () => {
    const ops = ['add', 'sub', 'mul', 'div', 'paren'] as const
    const problems = ops.flatMap((op) => [p({ op, expr: `${op} 1` }), p({ op, expr: `${op} 2`, correct: false })])
    const { measured } = evaluateQuickThink({ problems })
    expect(Object.keys(measured).length).toBeLessThanOrEqual(24)
    for (const [k, v] of Object.entries(measured)) {
      expect(k).toMatch(/^[A-Za-z0-9_-]{1,40}$/)
      expect(['number', 'string', 'boolean']).toContain(typeof v)
    }
    expect(validateAnalyzeRequest(buildQuickThinkPayload(core(problems))).ok).toBe(true)
  })
})

describe('quickThink definition', () => {
  it('matches the PRD and the agreed accent', () => {
    expect(quickThink).toMatchObject({ id: 'quick-think', name: 'QUICK THINK', category: 'CALC', kind: 'objective', accent: '--acid' })
    for (const d of ['easy', 'normal', 'hard'] as const) expect(quickThink.timeLimitSec(d)).toBe(60)
    expect(quickThink.rubric.length).toBeGreaterThan(0)
  })

  it('evaluates and builds a payload without throwing', () => {
    const { measured } = quickThink.evaluate({ problems: [p()] }, { difficulty: 'easy', elapsedMs: 5000, timedOut: false })
    expect(measured.attempts).toBe(1)
    expect(() => quickThink.buildAiPayload(core([p()]))).not.toThrow()
  })
})
