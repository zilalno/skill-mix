import type { Difficulty } from '../../types'
import { mulberry32, randomInt } from '../random'
import type { Rng } from '../random'

// QUICK THINK problem model and seeded generator (PRD 7.1).

export type Op = 'add' | 'sub' | 'mul' | 'div' | 'paren'
export const OPS: readonly Op[] = ['add', 'sub', 'mul', 'div', 'paren']
export const OP_LABEL: Record<Op, string> = {
  add: '덧셈',
  sub: '뺄셈',
  mul: '곱셈',
  div: '나눗셈',
  paren: '괄호식',
}

export interface Problem {
  expr: string
  op: Op
  answer: number
}

/** One answered problem. PRD 7.1 fields plus `answer`, so an analysis can quote the right value. */
export interface ProblemResult {
  expr: string
  op: Op
  userAnswer: number
  answer: number
  correct: boolean
  ms: number
}

export interface QuickThinkOutput {
  problems: ProblemResult[]
}

export const TIME_LIMIT_SEC = 60
export const MAX_ANSWER_DIGITS = 6

// Operator mix per difficulty. Division only appears on NORMAL; parentheses only on HARD (PRD 7.1).
const WEIGHTS: Record<Difficulty, ReadonlyArray<readonly [Op, number]>> = {
  easy: [
    ['add', 4],
    ['sub', 3],
    ['mul', 3],
  ],
  normal: [
    ['add', 3],
    ['sub', 3],
    ['mul', 2],
    ['div', 2],
  ],
  hard: [
    ['add', 2],
    ['sub', 2],
    ['mul', 3],
    ['paren', 3],
  ],
}

function pickOp(rng: Rng, difficulty: Difficulty): Op {
  const table = WEIGHTS[difficulty]
  const total = table.reduce((sum, [, w]) => sum + w, 0)
  let roll = rng() * total
  for (const [op, weight] of table) {
    roll -= weight
    if (roll < 0) return op
  }
  return table[table.length - 1][0]
}

/**
 * One problem. Guarantees: integer answer >= 1, never a negative intermediate or result
 * (subtraction always has a > b), and division always without remainder.
 */
export function makeProblem(rng: Rng, difficulty: Difficulty): Problem {
  const op = pickOp(rng, difficulty)
  switch (op) {
    case 'add': {
      const [lo, hi] = difficulty === 'hard' ? [100, 999] : [10, 99]
      const a = randomInt(rng, lo, hi)
      const b = randomInt(rng, lo, hi)
      return { expr: `${a} + ${b}`, op, answer: a + b }
    }
    case 'sub': {
      const [aLo, aHi, bLo] = difficulty === 'hard' ? [200, 999, 100] : [20, 99, 10]
      const a = randomInt(rng, aLo, aHi)
      const b = randomInt(rng, bLo, a - 1)
      return { expr: `${a} − ${b}`, op, answer: a - b }
    }
    case 'mul': {
      let a: number
      let b: number
      if (difficulty === 'easy') {
        a = randomInt(rng, 2, 9)
        b = randomInt(rng, 2, 9)
      } else if (difficulty === 'hard' && rng() < 0.4) {
        a = randomInt(rng, 11, 39)
        b = randomInt(rng, 11, 29)
      } else {
        a = randomInt(rng, 10, 99)
        b = randomInt(rng, 2, 9)
      }
      return { expr: `${a} × ${b}`, op, answer: a * b }
    }
    case 'div': {
      const divisor = randomInt(rng, 2, 9)
      const quotient = randomInt(rng, 2, 25)
      return { expr: `${divisor * quotient} ÷ ${divisor}`, op, answer: quotient }
    }
    case 'paren': {
      const c = randomInt(rng, 2, 9)
      if (rng() < 0.5) {
        const a = randomInt(rng, 2, 30)
        const b = randomInt(rng, 2, 30)
        return { expr: `(${a} + ${b}) × ${c}`, op, answer: (a + b) * c }
      }
      const a = randomInt(rng, 10, 50)
      const b = randomInt(rng, 1, a - 1)
      return { expr: `(${a} − ${b}) × ${c}`, op, answer: (a - b) * c }
    }
  }
}

/** Seeded problem stream. The same seed + difficulty always yields the same problems. */
export function createProblemGenerator(seed: number, difficulty: Difficulty): () => Problem {
  const rng = mulberry32(seed)
  let last = ''
  return () => {
    let problem = makeProblem(rng, difficulty)
    for (let tries = 0; problem.expr === last && tries < 20; tries++) problem = makeProblem(rng, difficulty)
    last = problem.expr
    return problem
  }
}

/** Turns typed text into a judged answer. Empty or non-numeric input is not an answer (null). */
export function judgeAnswer(problem: Problem, input: string): { userAnswer: number; correct: boolean } | null {
  if (!/^\d{1,6}$/.test(input)) return null
  const userAnswer = Number(input)
  return { userAnswer, correct: userAnswer === problem.answer }
}

export function toResult(problem: Problem, userAnswer: number, ms: number): ProblemResult {
  return {
    expr: problem.expr,
    op: problem.op,
    userAnswer,
    answer: problem.answer,
    correct: userAnswer === problem.answer,
    ms,
  }
}
