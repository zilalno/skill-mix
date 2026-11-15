import { describe, expect, it } from 'vitest'
import { validateAnalyzeRequest } from '../../../api/_lib/validate'
import type { SessionCore } from '../../types'
import type { PatternFindOutput, PuzzleResult } from './data'
import { evaluatePatternFind } from './evaluate'
import type { Measured } from './evaluate'
import { patternFind } from './index'
import { RUBRIC, buildPatternFindPayload } from './payload'

const r = (over: Partial<PuzzleResult> = {}): PuzzleResult => ({
  id: 'pf-e1',
  prompt: '빈칸(?)에 들어갈 항목을 고르세요.',
  choices: ['14', '13', '16', '15'],
  picked: 3,
  correct: true,
  ms: 20_000,
  ...over,
})

const measuredOf = (output: unknown) => evaluatePatternFind(output).measured

describe('evaluatePatternFind: empty and broken input', () => {
  it.each([
    ['no puzzles', { puzzles: [] }],
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
    ['puzzles is not an array', { puzzles: 'x' }],
    ['a number', 3],
  ])('gives clean zeros for %s', (_name, output) => {
    const { measured, labels } = evaluatePatternFind(output)
    expect(measured).toEqual({
      total: 0,
      answered: 0,
      correctCount: 0,
      accuracyPct: 0,
      skipped: 0,
      ruleCount: 0,
      avgSec: 0,
      slowestSec: 0,
    })
    for (const v of Object.values(measured)) expect(Number.isFinite(v as number)).toBe(true)
    expect(labels.map((l) => l.key)).toEqual(['correctCount', 'accuracyPct', 'skipped', 'ruleCount', 'avgSec', 'slowestSec'])
  })

  it('drops malformed rows', () => {
    const output = {
      puzzles: [
        r(),
        { id: 'x' },
        null,
        r({ picked: 9 }), // index outside the four choices
        r({ picked: 1.5 }),
        r({ ms: Number.POSITIVE_INFINITY }),
        r({ ruleText: 5 as unknown as string }),
        r({ choices: ['a', 2] as unknown as string[] }),
      ],
    }
    expect(measuredOf(output).total).toBe(1)
  })
})

describe('evaluatePatternFind: a known run', () => {
  const output: PatternFindOutput = {
    puzzles: [
      r({ id: 'pf-e1', picked: 3, correct: true, ms: 10_000, ruleText: '4씩 더한다' }),
      r({ id: 'pf-e2', picked: 0, correct: false, ms: 25_000 }),
      r({ id: 'pf-e3', picked: null, correct: false, ms: 5_000 }),
      r({ id: 'pf-e4', picked: 1, correct: true, ms: 40_000, ruleText: '   ' }),
      r({ id: 'pf-e5', picked: 2, correct: false, ms: 30_000, ruleText: '두 칸씩' }),
    ],
  }
  const { measured, labels } = evaluatePatternFind(output)

  it('counts correct, skipped and answered puzzles', () => {
    expect(measured.total).toBe(5)
    expect(measured.correctCount).toBe(2)
    expect(measured.skipped).toBe(1)
    expect(measured.answered).toBe(4)
  })

  it('computes accuracy out of all puzzles', () => {
    expect(measured.accuracyPct).toBe(40)
  })

  it('counts written rules, ignoring blank ones', () => {
    expect(measured.ruleCount).toBe(2)
  })

  it('reports time per puzzle, the average and the slowest', () => {
    expect([measured.t1, measured.t2, measured.t3, measured.t4, measured.t5]).toEqual([10, 25, 5, 40, 30])
    expect(measured.avgSec).toBe(22)
    expect(measured.slowestSec).toBe(40)
  })

  it('has a label with a unit for every advertised key', () => {
    for (const l of labels) expect(l.key in measured).toBe(true)
    expect(labels.filter((l) => /^t\d$/.test(String(l.key)))).toHaveLength(5)
    expect(labels.find((l) => l.key === 't2')).toMatchObject({ label: '2번 문제', unit: '초' })
    expect(labels.find((l) => l.key === 'accuracyPct')).toMatchObject({ label: '정확도', unit: '%' })
  })

  it('lets skipped puzzles count against accuracy', () => {
    const m = measuredOf({
      puzzles: [r(), r(), r(), r({ picked: null, correct: false }), r({ picked: null, correct: false })],
    })
    expect(m.accuracyPct).toBe(60)
    expect(m.answered).toBe(3)
  })

  it('handles a single puzzle', () => {
    const m = measuredOf({ puzzles: [r({ ms: 7_400 })] })
    expect(m).toMatchObject({ total: 1, correctCount: 1, accuracyPct: 100, avgSec: 7.4, slowestSec: 7.4, t1: 7.4 })
  })
})

// ---- AI payload ----

const core = (puzzles: PuzzleResult[]) => {
  const output = { puzzles }
  return {
    id: 's1',
    activityId: 'pattern-find',
    difficulty: 'easy',
    conditions: [...patternFind.rules, '제한 시간 150초'],
    elapsedSec: 140,
    timedOut: false,
    output,
    measured: evaluatePatternFind(output).measured,
  } as SessionCore<PatternFindOutput, Measured>
}

describe('buildPatternFindPayload', () => {
  // pf-e1: answer index 3 ('15'); picking index 1 ('13') is the "+2" mistake
  const wrong = r({ id: 'pf-e1', picked: 1, correct: false, ms: 12_340, ruleText: '2씩 더한다' })
  const right = r({ id: 'pf-e2', choices: ['24', '18', '32', '20'], picked: 2, correct: true, ms: 8_000 })
  const skipped = r({ id: 'pf-n2', choices: ['tri:0', 'tri:90', 'tri:270', 'tri:180'], picked: null, correct: false, ms: 3_000 })
  const table = r({ id: 'pf-n5', choices: ['3', '18', '7', '9'], picked: 0, correct: false, ms: 20_000 })

  it('describes what the player did per puzzle, in plain text', () => {
    const payload = buildPatternFindPayload(core([wrong, right, skipped]))
    expect(payload.userOutput).toEqual({
      puzzles: [
        { n: 1, sequence: '3, 7, 11, 빈칸(?), 19', choices: ['14', '13', '16', '15'], picked: '13', correct: false, sec: 12.3, ruleText: '2씩 더한다' },
        { n: 2, sequence: '2, 4, 8, 16, 빈칸(?)', choices: ['24', '18', '32', '20'], picked: '32', correct: true, sec: 8 },
        {
          n: 3,
          sequence: '채운 삼각형 0°, 채운 삼각형 90°, 채운 삼각형 180°, 빈칸(?)',
          choices: ['채운 삼각형 0°', '채운 삼각형 90°', '채운 삼각형 270°', '채운 삼각형 180°'],
          picked: null,
          correct: false,
          sec: 3,
        },
      ],
    })
  })

  it('puts the intended rule and right choice in knownReference, with a note only for a wrong pick', () => {
    const payload = buildPatternFindPayload(core([wrong, right, skipped, table]))
    expect(payload.knownReference).toEqual({
      puzzles: [
        { n: 1, intendedRule: '앞의 수에 4를 더한다(+4).', correctChoice: '15', pickedChoiceNote: '+2씩 늘어난다고 본 경우(11+2)' },
        { n: 2, intendedRule: '앞의 수에 2를 곱한다(×2).', correctChoice: '32' },
        { n: 3, intendedRule: '삼각형이 시계 방향으로 90°씩 돈다.', correctChoice: '채운 삼각형 270°' },
        {
          n: 4,
          intendedRule: '각 줄에서 왼쪽 두 수를 더하면 오른쪽 수가 된다.',
          correctChoice: '9',
          pickedChoiceNote: '두 수의 차(6−3)를 구한 경우',
        },
      ],
    })
  })

  it('does not send notes for options the player did not pick', () => {
    const text = JSON.stringify(buildPatternFindPayload(core([wrong, right])).knownReference)
    expect(text).not.toContain('+3씩')
    expect(text).not.toContain('+5씩')
  })

  it('skips the reference (and the sequence) for a puzzle that is no longer in the bank', () => {
    const payload = buildPatternFindPayload(core([r({ id: 'pf-gone' })]))
    expect((payload.userOutput as { puzzles: { sequence: string }[] }).puzzles[0].sequence).toBe('')
    expect(payload.knownReference).toEqual({ puzzles: [] })
  })

  it('carries the standard fields and the measured numbers unchanged', () => {
    const s = core([wrong, right])
    const payload = buildPatternFindPayload(s)
    expect(payload).toMatchObject({
      activityId: 'pattern-find',
      activityName: 'PATTERN FIND',
      category: 'LOGIC',
      kind: 'hybrid',
      difficulty: 'easy',
      elapsedSec: 140,
      rubric: RUBRIC,
    })
    expect(payload.measured).toEqual(s.measured)
  })

  it('handles zero puzzles', () => {
    const payload = buildPatternFindPayload(core([]))
    expect(payload.userOutput).toEqual({ puzzles: [] })
    expect(payload.knownReference).toEqual({ puzzles: [] })
  })

  it('passes the server whitelist and stays under 8KB, even with 60-character rules everywhere', () => {
    const rule = '가'.repeat(60)
    const five = [wrong, right, skipped, table, r({ id: 'pf-h4', choices: ['50', '75', '30', '125'], picked: 0, correct: false })].map((x) => ({
      ...x,
      ruleText: rule,
    }))
    const payload = buildPatternFindPayload(core(five))
    expect(validateAnalyzeRequest(payload).ok).toBe(true)
    expect(JSON.stringify(payload).length).toBeLessThan(8 * 1024)
  })
})

describe('patternFind definition', () => {
  it('matches the PRD and the agreed accent', () => {
    expect(patternFind).toMatchObject({ id: 'pattern-find', name: 'PATTERN FIND', category: 'LOGIC', kind: 'hybrid', accent: '--bubble' })
    for (const d of ['easy', 'normal', 'hard'] as const) expect(patternFind.timeLimitSec(d)).toBe(150)
    expect(patternFind.rubric.length).toBeGreaterThan(0)
  })

  it('evaluates and builds a payload without throwing', () => {
    const { measured } = patternFind.evaluate({ puzzles: [r()] }, { difficulty: 'easy', elapsedMs: 5000, timedOut: false })
    expect(measured.total).toBe(1)
    expect(() => patternFind.buildAiPayload(core([r()]))).not.toThrow()
  })
})
