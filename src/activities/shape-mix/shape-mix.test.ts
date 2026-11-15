import { describe, expect, it } from 'vitest'
import { validateAnalyzeRequest } from '../../../api/_lib/validate'
import type { Difficulty, SessionCore } from '../../types'
import { mulberry32 } from '../random'
import {
  CHALLENGES,
  allKinds,
  atLeast,
  centerEmpty,
  challengeConstraints,
  checkAll,
  cornersFilled,
  emptyGrid,
  everyRowHasShape,
  exactly,
  maxShapes,
  minShapes,
  nextShape,
  noAdjacentSame,
  parseBoard,
  pickChallenge,
  shapesOf,
  symmetricLR,
  symmetricUD,
  toRows,
} from './challenges'
import type { Cell, ShapeMixOutput } from './challenges'
import { evaluateShapeMix } from './evaluate'
import type { Measured } from './evaluate'
import { shapeMix } from './index'
import { buildShapeMixPayload } from './payload'

const b = parseBoard

describe('tap cycle', () => {
  it('goes empty -> O -> □ -> △ -> empty', () => {
    expect(nextShape('.')).toBe('O')
    expect(nextShape('O')).toBe('□')
    expect(nextShape('□')).toBe('△')
    expect(nextShape('△')).toBe('.')
  })
  it('starts as an empty 4x4 board', () => {
    const g = emptyGrid()
    expect(g).toHaveLength(16)
    expect(g.every((c) => c.shape === '.')).toBe(true)
  })
})

describe('board text', () => {
  it('round-trips rows', () => {
    expect(toRows(b('O.□△/..../..../△△△△'))).toEqual(['O.□△', '....', '....', '△△△△'])
  })
  it('rejects a malformed board', () => {
    expect(() => parseBoard('O.□')).toThrow()
    expect(() => parseBoard('X'.repeat(16))).toThrow()
  })
})

describe('condition functions: pass and fail', () => {
  it('minShapes / maxShapes', () => {
    expect(minShapes(3).check(b('OOO./..../..../....'))).toBe(true)
    expect(minShapes(3).check(b('OO../..../..../....'))).toBe(false)
    expect(maxShapes(2).check(b('OO../..../..../....'))).toBe(true)
    expect(maxShapes(2).check(b('OOO./..../..../....'))).toBe(false)
  })
  it('exactly / atLeast', () => {
    expect(exactly('O', '○', 2).check(b('O.O./..../..../....'))).toBe(true)
    expect(exactly('O', '○', 2).check(b('O.OO/..../..../....'))).toBe(false)
    expect(atLeast('△', '△', 2).check(b('△.△./..../..../....'))).toBe(true)
    expect(atLeast('△', '△', 2).check(b('△.../..../..../....'))).toBe(false)
  })
  it('allKinds', () => {
    expect(allKinds.check(b('O□△./..../..../....'))).toBe(true)
    expect(allKinds.check(b('O□O./..../..../....'))).toBe(false)
  })
  it('noAdjacentSame: sideways, vertical, and diagonal is fine', () => {
    expect(noAdjacentSame.check(b('O□O□/□O□O/..../....'))).toBe(true)
    expect(noAdjacentSame.check(b('OO../..../..../....'))).toBe(false)
    expect(noAdjacentSame.check(b('O.../O.../..../....'))).toBe(false)
    expect(noAdjacentSame.check(b('O.../.O../..../....'))).toBe(true)
    expect(noAdjacentSame.check(b('..../..../..../....'))).toBe(true)
  })
  it('symmetricLR / symmetricUD', () => {
    expect(symmetricLR.check(b('O□□O/..../..../△..△'))).toBe(true)
    expect(symmetricLR.check(b('O□.O/..../..../....'))).toBe(false)
    expect(symmetricUD.check(b('O□△./..../..../O□△.'))).toBe(true)
    expect(symmetricUD.check(b('O.../..../..../....'))).toBe(false)
  })
  it('centerEmpty: only the middle 2x2 counts', () => {
    expect(centerEmpty.check(b('OOOO/O..O/O..O/OOOO'))).toBe(true)
    expect(centerEmpty.check(b('..../.O../..../....'))).toBe(false)
    expect(centerEmpty.check(b('..../..../...O/....'))).toBe(true)
  })
  it('cornersFilled', () => {
    expect(cornersFilled.check(b('O..□/..../..../△..O'))).toBe(true)
    expect(cornersFilled.check(b('O..□/..../..../△...'))).toBe(false)
  })
  it('everyRowHasShape', () => {
    expect(everyRowHasShape.check(b('O.../.□../..△./...O'))).toBe(true)
    expect(everyRowHasShape.check(b('O.../.□../..../...O'))).toBe(false)
  })
})

describe('challenge bank', () => {
  it('has at least three challenges per difficulty with unique ids', () => {
    const ids = CHALLENGES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
      expect(CHALLENGES.filter((c) => c.difficulty === d).length).toBeGreaterThanOrEqual(3)
    }
  })

  it.each(CHALLENGES.map((c) => [c.id, c] as const))('%s: three known conditions', (_id, c) => {
    expect(c.constraintIds).toHaveLength(3)
    expect(new Set(c.constraintIds).size).toBe(3)
    expect(challengeConstraints(c)).toHaveLength(3)
  })

  it.each(CHALLENGES.map((c) => [c.id, c] as const))('%s: has at least two different valid answers', (_id, c) => {
    expect(c.examples.length).toBeGreaterThanOrEqual(2)
    expect(new Set(c.examples.map((e) => b(e).join(''))).size).toBe(c.examples.length)
    for (const example of c.examples) {
      const results = checkAll(c, b(example))
      expect(results.filter((r) => !r.met).map((r) => r.id), `${c.id} ${example}`).toEqual([])
    }
  })

  it.each(CHALLENGES.map((c) => [c.id, c] as const))('%s: an empty board is not already a win', (_id, c) => {
    expect(checkAll(c, shapesOf(emptyGrid())).every((r) => r.met)).toBe(false)
  })

  it('pickChallenge stays inside the difficulty', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(pickChallenge('hard', mulberry32(seed)).difficulty).toBe('hard')
    }
  })
})

const gridOf = (text: string): Cell[] => b(text).map((shape, i) => ({ shape, color: i % 2 ? 'B' : 'A' }))

const sample = (over: Partial<ShapeMixOutput> = {}): ShapeMixOutput => {
  const challenge = CHALLENGES.find((c) => c.id === 'sm-n1')!
  const grid = gridOf('O□□O/..../..../O△△O')
  return {
    challengeId: challenge.id,
    grid,
    constraints: checkAll(challenge, shapesOf(grid)),
    edits: 9,
    ...over,
  }
}

describe('evaluateShapeMix', () => {
  it('reports x/3, counts, edits and time', () => {
    const { measured } = evaluateShapeMix(sample(), { difficulty: 'normal', elapsedMs: 80_000, timedOut: false })
    expect(measured).toMatchObject({
      constraintsMet: 3,
      constraintsTotal: 3,
      placed: 8,
      circleCount: 4,
      squareCount: 2,
      triangleCount: 2,
      edits: 9,
      elapsedSec: 80,
    })
  })

  it('counts an unmet condition and trusts the grid over a stored met flag', () => {
    const challenge = CHALLENGES.find((c) => c.id === 'sm-n1')!
    const grid = gridOf('O□.O/..../..../O△△O') // not mirrored
    const lying = checkAll(challenge, shapesOf(grid)).map((c) => ({ ...c, met: true }))
    const { measured } = evaluateShapeMix(sample({ grid, constraints: lying }))
    expect(measured.constraintsMet).toBe(2) // only the mirror condition fails
  })

  it('keeps the stored result for a condition id it does not know', () => {
    const { measured } = evaluateShapeMix(sample({ constraints: [{ id: 'future', label: '?', met: true }] }))
    expect(measured).toMatchObject({ constraintsMet: 1, constraintsTotal: 1 })
  })

  it.each([null, undefined, 'x', {}, { grid: 'no', constraints: 5, edits: -3 }])('is total for %j', (bad) => {
    const { measured } = evaluateShapeMix(bad)
    expect(measured).toMatchObject({ constraintsMet: 0, placed: 0, edits: 0 })
    for (const v of Object.values(measured)) expect(Number.isNaN(v)).toBe(false)
  })
})

describe('buildShapeMixPayload', () => {
  const out = sample()
  const core: SessionCore<ShapeMixOutput, Measured> = {
    id: 's1',
    activityId: 'shape-mix',
    difficulty: 'normal',
    conditions: ['제한 시간 120초'],
    elapsedSec: 80,
    timedOut: false,
    output: out,
    measured: evaluateShapeMix(out).measured,
  }
  const payload = buildShapeMixPayload(core)

  it('sends the grid as row strings, without colours', () => {
    expect(payload.userOutput).toMatchObject({
      challengeId: 'sm-n1',
      grid: ['O□□O', '....', '....', 'O△△O'],
      edits: 9,
    })
    expect(JSON.stringify(payload.userOutput)).not.toMatch(/color/)
  })
  it('lists the conditions with their results', () => {
    const u = payload.userOutput as { constraints: { label: string; met: boolean }[] }
    expect(u.constraints).toHaveLength(3)
    expect(u.constraints.every((c) => c.met)).toBe(true)
    for (const c of u.constraints) expect(payload.conditions).toContain(c.label)
  })
  it('passes the server request validation', () => {
    expect(validateAnalyzeRequest(payload).ok).toBe(true)
  })
})

describe('activity definition', () => {
  it('uses the cobalt accent, 120s and an open-ended rubric', () => {
    expect(shapeMix.accent).toBe('--cobalt')
    expect(shapeMix.kind).toBe('open')
    expect(shapeMix.timeLimitSec('easy')).toBe(120)
    expect(shapeMix.rubric.length).toBeGreaterThan(0)
  })
})
