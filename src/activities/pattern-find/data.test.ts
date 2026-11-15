import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../../types'
import { mulberry32 } from '../random'
import {
  BLANK,
  PUZZLE_BANK,
  PUZZLE_COUNT,
  RULE_MAX_CHARS,
  buildResults,
  getPuzzle,
  isPuzzleCorrect,
  parseShape,
  selectPuzzles,
  sequenceText,
  tokenText,
} from './data'
import type { PatternPuzzle, PuzzleKind } from './data'

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']
const RANK: Record<Difficulty, number> = { easy: 0, normal: 1, hard: 2 }

const puzzle = (id: string) => {
  const p = getPuzzle(id)
  if (!p) throw new Error(`missing puzzle ${id}`)
  return p
}
/** The item that belongs in the blank. */
const answerOf = (p: PatternPuzzle) => p.choices[p.answerIndex]
/** Items with the blank filled in by the intended answer. */
const filled = (p: PatternPuzzle) => p.items.map((i) => (i === BLANK ? answerOf(p) : i))
const nums = (p: PatternPuzzle) => filled(p).map(Number)
const letterIdx = (c: string) => c.charCodeAt(0) - 64 // A = 1

describe('puzzle bank: integrity', () => {
  it('has 12 to 15 puzzles, 4 or 5 per difficulty, with unique ids', () => {
    expect(PUZZLE_BANK.length).toBeGreaterThanOrEqual(12)
    expect(PUZZLE_BANK.length).toBeLessThanOrEqual(15)
    for (const d of DIFFICULTIES) {
      const n = PUZZLE_BANK.filter((p) => p.difficulty === d).length
      expect(n).toBeGreaterThanOrEqual(4)
      expect(n).toBeLessThanOrEqual(5)
    }
    expect(new Set(PUZZLE_BANK.map((p) => p.id)).size).toBe(PUZZLE_BANK.length)
  })

  it.each(PUZZLE_BANK.map((p) => [p.id, p] as const))('%s: four distinct choices and exactly one right answer', (_id, p) => {
    expect(p.choices).toHaveLength(4)
    expect(new Set(p.choices).size).toBe(4)
    expect(Number.isInteger(p.answerIndex)).toBe(true)
    expect(p.answerIndex).toBeGreaterThanOrEqual(0)
    expect(p.answerIndex).toBeLessThan(4)
    // judged through the same function the Stage uses: only one index is correct
    expect([0, 1, 2, 3].filter((i) => isPuzzleCorrect(p, i))).toEqual([p.answerIndex])
    expect(p.choices).not.toContain(BLANK)
  })

  it.each(PUZZLE_BANK.map((p) => [p.id, p] as const))('%s: has an intendedRule and a note for every wrong choice', (_id, p) => {
    expect(p.intendedRule.trim().length).toBeGreaterThan(0)
    expect(p.distractorNotes).toHaveLength(4)
    p.distractorNotes.forEach((note, i) => {
      if (i === p.answerIndex) expect(note).toBe('')
      else expect(note.trim().length).toBeGreaterThan(0)
    })
    expect(new Set(p.distractorNotes.filter(Boolean)).size).toBe(3) // each wrong choice says something different
  })

  it.each(PUZZLE_BANK.map((p) => [p.id, p] as const))('%s: has exactly one blank and a usable layout', (_id, p) => {
    expect(p.items.filter((i) => i === BLANK)).toHaveLength(1)
    expect(p.prompt.length).toBeGreaterThan(0)
    if (p.columns !== undefined) {
      expect(p.kind).toBe('table')
      expect(p.items.length % p.columns).toBe(0)
    }
  })

  it('covers every puzzle type the PRD lists', () => {
    const kinds = new Set<PuzzleKind>(PUZZLE_BANK.map((p) => p.kind))
    for (const k of ['arithmetic', 'geometric', 'alternating', 'letter-shift', 'rotation', 'table'] as const) {
      expect(kinds.has(k)).toBe(true)
    }
  })

  it('does not always put the right answer in the same position', () => {
    expect(new Set(PUZZLE_BANK.map((p) => p.answerIndex))).toEqual(new Set([0, 1, 2, 3]))
  })

  it('uses only shape tokens the Stage can draw', () => {
    for (const p of PUZZLE_BANK) {
      for (const v of [...p.items, ...p.choices]) {
        if (/^(circle|ring|square|box|tri|trio)/.test(v)) {
          const shape = parseShape(v)
          expect(shape).not.toBeNull()
          expect(shape!.deg % 90).toBe(0)
        }
      }
    }
  })
})

describe('puzzle bank: the intended answers are really right', () => {
  it('arithmetic puzzles have a constant difference', () => {
    for (const p of PUZZLE_BANK.filter((x) => x.kind === 'arithmetic')) {
      const v = nums(p)
      const d = v[1] - v[0]
      v.slice(1).forEach((x, i) => expect(x - v[i]).toBe(d))
    }
  })

  it('geometric puzzles have a constant ratio', () => {
    for (const p of PUZZLE_BANK.filter((x) => x.kind === 'geometric')) {
      const v = nums(p)
      const r = v[1] / v[0]
      v.slice(1).forEach((x, i) => expect(x / v[i]).toBe(r))
    }
  })

  it('pf-e3 alternates circle and square', () => {
    expect(filled(puzzle('pf-e3'))).toEqual(['circle', 'square', 'circle', 'square', 'circle', 'square'])
  })

  it('pf-e4 interleaves 1,2,3,… with their tens', () => {
    expect(nums(puzzle('pf-e4'))).toEqual([1, 10, 2, 20, 3, 30])
  })

  it('pf-e5 moves two letters at a time', () => {
    const v = filled(puzzle('pf-e5')).map(letterIdx)
    v.slice(1).forEach((x, i) => expect(x - v[i]).toBe(2))
  })

  it('pf-n2 turns the triangle 90° clockwise each step', () => {
    const degs = filled(puzzle('pf-n2')).map((t) => parseShape(t)!.deg)
    expect(degs).toEqual([0, 90, 180, 270])
  })

  it('pf-n3 applies +3 and −2 alternately', () => {
    const v = nums(puzzle('pf-n3'))
    expect(v).toEqual([5, 8, 6, 9, 7, 10])
    v.slice(1).forEach((x, i) => expect(x - v[i]).toBe(i % 2 === 0 ? 3 : -2))
  })

  it('pf-n4 grows the letter step 2, 3, 4, 5', () => {
    const v = filled(puzzle('pf-n4')).map(letterIdx)
    expect(v.slice(1).map((x, i) => x - v[i])).toEqual([2, 3, 4, 5])
  })

  it('pf-n5: in every row the first two numbers add up to the third', () => {
    const v = nums(puzzle('pf-n5'))
    for (let r = 0; r < 3; r++) expect(v[r * 3] + v[r * 3 + 1]).toBe(v[r * 3 + 2])
  })

  it('pf-h1 applies +1 and ×2 alternately', () => {
    const v = nums(puzzle('pf-h1'))
    v.slice(1).forEach((x, i) => expect(x).toBe(i % 2 === 0 ? v[i] + 1 : v[i] * 2))
  })

  it('pf-h2 multiplies by 2, 3, 4, 5', () => {
    const v = nums(puzzle('pf-h2'))
    expect(v.slice(1).map((x, i) => x / v[i])).toEqual([2, 3, 4, 5])
  })

  it('pf-h3 rotates 90° each step and alternates filled / hollow', () => {
    const t = filled(puzzle('pf-h3')).map((x) => parseShape(x)!)
    expect(t.map((s) => s.deg)).toEqual([0, 90, 180, 270, 0])
    expect(t.map((s) => s.shape)).toEqual(['tri', 'trio', 'tri', 'trio', 'tri'])
  })

  it('pf-h4: each row is n, n², n³', () => {
    const v = nums(puzzle('pf-h4'))
    for (let r = 0; r < 3; r++) {
      const [n, sq, cube] = v.slice(r * 3, r * 3 + 3)
      expect(sq).toBe(n ** 2)
      expect(cube).toBe(n ** 3)
    }
  })

  it('pf-h5 alternates A,B,C… with Z,Y,X…', () => {
    expect(filled(puzzle('pf-h5'))).toEqual(['A', 'Z', 'B', 'Y', 'C', 'X'])
  })
})

describe('isPuzzleCorrect', () => {
  const p = puzzle('pf-e1') // right answer: index 3

  it('judges a right pick, a wrong pick and a skip', () => {
    expect(isPuzzleCorrect(p, 3)).toBe(true)
    expect(isPuzzleCorrect(p, 0)).toBe(false)
    expect(isPuzzleCorrect(p, null)).toBe(false)
  })
})

describe('selectPuzzles', () => {
  const run = (d: Difficulty, seed: number) => selectPuzzles(d, mulberry32(seed))

  it.each(DIFFICULTIES)('%s: five distinct bank puzzles, mostly of that difficulty and never two levels away', (d) => {
    for (let seed = 1; seed <= 200; seed++) {
      const picked = run(d, seed)
      expect(picked).toHaveLength(PUZZLE_COUNT)
      expect(new Set(picked.map((p) => p.id)).size).toBe(PUZZLE_COUNT)
      expect(picked.filter((p) => p.difficulty === d).length).toBeGreaterThanOrEqual(3)
      for (const p of picked) {
        expect(PUZZLE_BANK).toContain(p)
        expect(Math.abs(RANK[p.difficulty] - RANK[d])).toBeLessThanOrEqual(1)
      }
    }
  })

  it('is deterministic for a seed and varies between seeds', () => {
    const ids = (seed: number) => run('normal', seed).map((p) => p.id).join(',')
    expect(ids(5)).toBe(ids(5))
    expect(new Set(Array.from({ length: 30 }, (_, s) => ids(s))).size).toBeGreaterThan(5)
  })

  it('eventually offers every puzzle of the chosen difficulty', () => {
    for (const d of DIFFICULTIES) {
      const seen = new Set<string>()
      for (let seed = 1; seed <= 200; seed++) run(d, seed).forEach((p) => seen.add(p.id))
      for (const p of PUZZLE_BANK.filter((x) => x.difficulty === d)) expect(seen.has(p.id)).toBe(true)
    }
  })

  it('honours a smaller count', () => {
    const three = selectPuzzles('easy', mulberry32(1), 3)
    expect(three).toHaveLength(3)
    expect(new Set(three.map((p) => p.id)).size).toBe(3)
  })
})

describe('buildResults', () => {
  const puzzles = [puzzle('pf-e1'), puzzle('pf-e2'), puzzle('pf-e3')]

  it('turns live state into PRD 7.2 rows', () => {
    const rows = buildResults(puzzles, [3, 0, null], ['  앞 수에 4를 더한다  ', '', ''], [12_340.4, 5000, 800])
    expect(rows).toEqual([
      { id: 'pf-e1', prompt: puzzles[0].prompt, choices: puzzles[0].choices, picked: 3, correct: true, ms: 12_340, ruleText: '앞 수에 4를 더한다' },
      { id: 'pf-e2', prompt: puzzles[1].prompt, choices: puzzles[1].choices, picked: 0, correct: false, ms: 5000 },
      { id: 'pf-e3', prompt: puzzles[2].prompt, choices: puzzles[2].choices, picked: null, correct: false, ms: 800 },
    ])
  })

  it('omits ruleText when it is empty or only spaces', () => {
    const rows = buildResults(puzzles, [null, null, null], ['', '   ', ''], [0, 0, 0])
    for (const r of rows) expect('ruleText' in r).toBe(false)
  })

  it('cuts a rule at 60 characters', () => {
    const [row] = buildResults([puzzles[0]], [1], ['가'.repeat(100)], [0])
    expect(row.ruleText).toHaveLength(RULE_MAX_CHARS)
  })

  it('reads missing entries as skipped and clamps bad times', () => {
    const rows = buildResults(puzzles, [], [], [-5, Number.NaN])
    expect(rows.map((r) => r.picked)).toEqual([null, null, null])
    expect(rows.map((r) => r.ms)).toEqual([0, 0, 0])
  })

  it('does not share the bank arrays with the output', () => {
    const [row] = buildResults([puzzles[0]], [0], [''], [0])
    row.choices.push('x')
    expect(puzzles[0].choices).toHaveLength(4)
  })

  it('returns nothing for zero puzzles', () => {
    expect(buildResults([], [], [], [])).toEqual([])
  })
})

describe('token text', () => {
  it('describes shapes, rotation and the blank', () => {
    expect(tokenText(BLANK)).toBe('빈칸(?)')
    expect(tokenText('circle')).toBe('채운 원')
    expect(tokenText('box')).toBe('속 빈 네모')
    expect(tokenText('tri:90')).toBe('채운 삼각형 90°')
    expect(tokenText('trio:270')).toBe('속 빈 삼각형 270°')
    expect(tokenText('17')).toBe('17')
  })

  it('writes sequences on one line and tables row by row', () => {
    expect(sequenceText(puzzle('pf-e1'))).toBe('3, 7, 11, 빈칸(?), 19')
    expect(sequenceText(puzzle('pf-n5'))).toBe('2, 3, 5 / 4, 1, 5 / 3, 6, 빈칸(?)')
    expect(sequenceText(puzzle('pf-n2'))).toBe('채운 삼각형 0°, 채운 삼각형 90°, 채운 삼각형 180°, 빈칸(?)')
  })

  it('parseShape rejects things that are not shapes', () => {
    expect(parseShape('triangle')).toBeNull()
    expect(parseShape('A')).toBeNull()
    expect(parseShape('tri:90')).toEqual({ shape: 'tri', deg: 90 })
  })
})
