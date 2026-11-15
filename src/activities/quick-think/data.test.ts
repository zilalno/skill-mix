import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../../types'
import { createProblemGenerator, judgeAnswer, toResult } from './data'
import type { Op, Problem } from './data'

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']

/** Independent check: evaluate the displayed expression itself, not the generator's own answer. */
function calc(expr: string): number {
  const js = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  if (!/^[0-9+\-*/() ]+$/.test(js)) throw new Error(`unexpected characters in ${expr}`)
  return new Function(`"use strict"; return (${js})`)() as number
}

function sample(difficulty: Difficulty, seeds = 120, perSeed = 40): Problem[] {
  const out: Problem[] = []
  for (let seed = 1; seed <= seeds; seed++) {
    const next = createProblemGenerator(seed, difficulty)
    for (let i = 0; i < perSeed; i++) out.push(next())
  }
  return out
}

const nums = (expr: string) => (expr.match(/\d+/g) ?? []).map(Number)

describe('generator: every difficulty', () => {
  it.each(DIFFICULTIES)('%s: the answer equals the expression, is an integer, and is never negative', (d) => {
    for (const p of sample(d)) {
      const value = calc(p.expr)
      expect(value).toBe(p.answer)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(1)
    }
  })

  it.each(DIFFICULTIES)('%s: never repeats the same expression twice in a row', (d) => {
    const next = createProblemGenerator(42, d)
    let last = ''
    for (let i = 0; i < 1000; i++) {
      const p = next()
      expect(p.expr).not.toBe(last)
      last = p.expr
    }
  })

  it.each(DIFFICULTIES)('%s: is deterministic for a seed and differs between seeds', (d) => {
    const run = (seed: number) => {
      const next = createProblemGenerator(seed, d)
      return Array.from({ length: 30 }, () => next().expr)
    }
    expect(run(2024)).toEqual(run(2024))
    expect(run(2024)).not.toEqual(run(2025))
  })
})

describe('generator: operator sets (PRD 7.1)', () => {
  const ops = (d: Difficulty) => new Set(sample(d, 30).map((p) => p.op))

  it('EASY uses only + − ×', () => {
    expect(ops('easy')).toEqual(new Set<Op>(['add', 'sub', 'mul']))
  })
  it('NORMAL adds integer division but no parentheses', () => {
    expect(ops('normal')).toEqual(new Set<Op>(['add', 'sub', 'mul', 'div']))
  })
  it('HARD adds parentheses and no division', () => {
    expect(ops('hard')).toEqual(new Set<Op>(['add', 'sub', 'mul', 'paren']))
  })
})

describe('generator: operand ranges (PRD 7.1)', () => {
  const only = (d: Difficulty, op: Op) => sample(d).filter((p) => p.op === op)

  it('EASY: two-digit + and −, single-digit ×', () => {
    for (const p of only('easy', 'add')) nums(p.expr).forEach((n) => expect(n >= 10 && n <= 99).toBe(true))
    for (const p of only('easy', 'sub')) {
      const [a, b] = nums(p.expr)
      expect(a).toBeGreaterThanOrEqual(20)
      expect(a).toBeLessThanOrEqual(99)
      expect(b).toBeGreaterThanOrEqual(10)
      expect(a).toBeGreaterThan(b) // no negative result
    }
    for (const p of only('easy', 'mul')) nums(p.expr).forEach((n) => expect(n >= 2 && n <= 9).toBe(true))
  })

  it('NORMAL: two-digit × one-digit, and division with no remainder', () => {
    for (const p of only('normal', 'mul')) {
      const [a, b] = nums(p.expr)
      expect(a >= 10 && a <= 99).toBe(true)
      expect(b >= 2 && b <= 9).toBe(true)
    }
    for (const p of only('normal', 'div')) {
      const [dividend, divisor] = nums(p.expr)
      expect(divisor >= 2 && divisor <= 9).toBe(true)
      expect(dividend % divisor).toBe(0)
      expect(dividend / divisor).toBe(p.answer)
      expect(p.answer).toBeGreaterThanOrEqual(2)
    }
    for (const p of [...only('normal', 'add'), ...only('normal', 'sub')]) {
      nums(p.expr).forEach((n) => expect(n >= 10 && n <= 99).toBe(true))
    }
  })

  it('HARD: three-digit + and −, some two-digit × two-digit, parentheses with two terms', () => {
    for (const p of only('hard', 'add')) nums(p.expr).forEach((n) => expect(n >= 100 && n <= 999).toBe(true))
    for (const p of only('hard', 'sub')) {
      const [a, b] = nums(p.expr)
      expect(a >= 200 && a <= 999).toBe(true)
      expect(b >= 100).toBe(true)
      expect(a).toBeGreaterThan(b)
    }
    const muls = only('hard', 'mul')
    const twoByTwo = muls.filter((p) => nums(p.expr).every((n) => n >= 10))
    expect(twoByTwo.length).toBeGreaterThan(0) // "some" two-digit × two-digit
    expect(twoByTwo.length).toBeLessThan(muls.length) // ...but not all of them
    for (const p of muls) {
      const [a, b] = nums(p.expr)
      const ok = (a >= 11 && a <= 39 && b >= 11 && b <= 29) || (a >= 10 && a <= 99 && b >= 2 && b <= 9)
      expect(ok).toBe(true)
    }
    for (const p of only('hard', 'paren')) {
      const m = /^\((\d+) ([+−]) (\d+)\) × (\d+)$/.exec(p.expr)
      expect(m).not.toBeNull()
      const [, a, sign, b, c] = m!
      if (sign === '−') expect(Number(a)).toBeGreaterThan(Number(b)) // no negative inside the brackets
      expect(Number(c) >= 2 && Number(c) <= 9).toBe(true)
    }
  })
})

describe('judgeAnswer', () => {
  const problem: Problem = { expr: '47 + 38', op: 'add', answer: 85 }

  it('judges a right and a wrong answer', () => {
    expect(judgeAnswer(problem, '85')).toEqual({ userAnswer: 85, correct: true })
    expect(judgeAnswer(problem, '84')).toEqual({ userAnswer: 84, correct: false })
  })

  it('reads leading zeros as the same number', () => {
    expect(judgeAnswer(problem, '085')).toEqual({ userAnswer: 85, correct: true })
  })

  it.each(['', ' ', 'abc', '-5', '8 5', '1.5', '1234567'])('treats %j as no answer', (input) => {
    expect(judgeAnswer(problem, input)).toBeNull()
  })
})

describe('toResult', () => {
  const problem: Problem = { expr: '91 − 28', op: 'sub', answer: 63 }

  it('keeps the PRD 7.1 fields and the right answer', () => {
    expect(toResult(problem, 63, 2100)).toEqual({
      expr: '91 − 28',
      op: 'sub',
      userAnswer: 63,
      answer: 63,
      correct: true,
      ms: 2100,
    })
  })

  it('marks a wrong answer', () => {
    expect(toResult(problem, 62, 900).correct).toBe(false)
  })
})
