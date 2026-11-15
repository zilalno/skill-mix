import type { Difficulty } from '../../types'
import { randomInt } from '../random'
import type { Rng } from '../random'

export const TIME_LIMIT_SEC = 120
export const SIZE = 4
export const CELLS = SIZE * SIZE

export type Shape = '.' | 'O' | '□' | '△'
export type CellColor = 'A' | 'B'

export interface Cell {
  shape: Shape
  color: CellColor
}

/** Tap order (PRD 7.4): empty -> circle -> square -> triangle -> empty. */
export const SHAPE_CYCLE: readonly Shape[] = ['.', 'O', '□', '△']

export const nextShape = (s: Shape): Shape => SHAPE_CYCLE[(SHAPE_CYCLE.indexOf(s) + 1) % SHAPE_CYCLE.length]

export const emptyGrid = (): Cell[] => Array.from({ length: CELLS }, () => ({ shape: '.', color: 'A' }))

const at = (g: readonly Shape[], r: number, c: number): Shape => g[r * SIZE + c]
const count = (g: readonly Shape[], s: Shape) => g.filter((x) => x === s).length
const filled = (g: readonly Shape[]) => g.filter((x) => x !== '.').length

// ---- Conditions: every one is a pure function of the 16 shapes ----------------

export interface Constraint {
  id: string
  label: string
  check: (g: readonly Shape[]) => boolean
}

export const minShapes = (n: number): Constraint => ({
  id: `min-${n}`,
  label: `도형 ${n}개 이상 놓기`,
  check: (g) => filled(g) >= n,
})
export const maxShapes = (n: number): Constraint => ({
  id: `max-${n}`,
  label: `도형 ${n}개 이하로 놓기`,
  check: (g) => filled(g) <= n,
})
export const exactly = (s: Exclude<Shape, '.'>, name: string, n: number): Constraint => ({
  id: `exact-${name}-${n}`,
  label: `${name}는 정확히 ${n}개`,
  check: (g) => count(g, s) === n,
})
export const atLeast = (s: Exclude<Shape, '.'>, name: string, n: number): Constraint => ({
  id: `atleast-${name}-${n}`,
  label: `${name}는 ${n}개 이상`,
  check: (g) => count(g, s) >= n,
})

export const allKinds: Constraint = {
  id: 'all-kinds',
  label: '○ □ △ 세 종류를 모두 사용하기',
  check: (g) => count(g, 'O') > 0 && count(g, '□') > 0 && count(g, '△') > 0,
}

/** No two orthogonally touching cells hold the same shape (empty cells never count). */
export const noAdjacentSame: Constraint = {
  id: 'no-adjacent-same',
  label: '같은 도형끼리 상하좌우로 맞닿지 않기',
  check: (g) => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const s = at(g, r, c)
        if (s === '.') continue
        if (c + 1 < SIZE && at(g, r, c + 1) === s) return false
        if (r + 1 < SIZE && at(g, r + 1, c) === s) return false
      }
    }
    return true
  },
}

export const symmetricLR: Constraint = {
  id: 'sym-lr',
  label: '좌우 대칭으로 놓기',
  check: (g) => {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE / 2; c++) if (at(g, r, c) !== at(g, r, SIZE - 1 - c)) return false
    return true
  },
}

export const symmetricUD: Constraint = {
  id: 'sym-ud',
  label: '상하 대칭으로 놓기',
  check: (g) => {
    for (let r = 0; r < SIZE / 2; r++) for (let c = 0; c < SIZE; c++) if (at(g, r, c) !== at(g, SIZE - 1 - r, c)) return false
    return true
  },
}

export const centerEmpty: Constraint = {
  id: 'center-empty',
  label: '가운데 2×2는 비우기',
  check: (g) => [1, 2].every((r) => [1, 2].every((c) => at(g, r, c) === '.')),
}

export const cornersFilled: Constraint = {
  id: 'corners-filled',
  label: '네 모서리 칸은 모두 채우기',
  check: (g) => [0, SIZE - 1].every((r) => [0, SIZE - 1].every((c) => at(g, r, c) !== '.')),
}

export const everyRowHasShape: Constraint = {
  id: 'every-row',
  label: '모든 행에 도형이 하나 이상 있기',
  check: (g) =>
    Array.from({ length: SIZE }, (_, r) => r).every((r) =>
      Array.from({ length: SIZE }, (_, c) => at(g, r, c)).some((s) => s !== '.'),
    ),
}

const ALL_CONSTRAINTS: readonly Constraint[] = [
  minShapes(6),
  minShapes(8),
  maxShapes(8),
  maxShapes(10),
  exactly('O', '○', 4),
  exactly('□', '□', 3),
  atLeast('△', '△', 3),
  allKinds,
  noAdjacentSame,
  symmetricLR,
  symmetricUD,
  centerEmpty,
  cornersFilled,
  everyRowHasShape,
]

const CONSTRAINT_BY_ID = new Map(ALL_CONSTRAINTS.map((c) => [c.id, c]))

export const getConstraint = (id: string): Constraint | undefined => CONSTRAINT_BY_ID.get(id)

// ---- Challenges ---------------------------------------------------------------

export interface Challenge {
  id: string
  difficulty: Difficulty
  /** Exactly three condition ids from ALL_CONSTRAINTS. */
  constraintIds: [string, string, string]
  /** At least two different, valid boards ("rows/rows/rows/rows"), proving there is no single answer. */
  examples: string[]
}

export const CHALLENGES: readonly Challenge[] = [
  {
    id: 'sm-e1',
    difficulty: 'easy',
    constraintIds: ['min-6', 'all-kinds', 'no-adjacent-same'],
    examples: ['O□O□/△.△./..../....', 'O□△O/□△O□/..../....'],
  },
  {
    id: 'sm-e2',
    difficulty: 'easy',
    constraintIds: ['exact-○-4', 'corners-filled', 'center-empty'],
    examples: ['O..O/..../..../O..O', '□OO□/O..O/..../△..△'],
  },
  {
    id: 'sm-e3',
    difficulty: 'easy',
    constraintIds: ['every-row', 'all-kinds', 'max-8'],
    examples: ['O.../□.../△.../O...', '.O../□.../..△./...O'],
  },
  {
    id: 'sm-n1',
    difficulty: 'normal',
    constraintIds: ['sym-lr', 'exact-○-4', 'center-empty'],
    examples: ['O..O/..../..../O..O', 'O□□O/..../..../O△△O'],
  },
  {
    id: 'sm-n2',
    difficulty: 'normal',
    constraintIds: ['min-8', 'all-kinds', 'no-adjacent-same'],
    examples: ['O□O□/□△□O/..../....', 'O□O□/△O△O/..../....'],
  },
  {
    id: 'sm-n3',
    difficulty: 'normal',
    constraintIds: ['atleast-△-3', 'sym-ud', 'max-10'],
    examples: ['△△../O.../O.../△△..', '△.△./..O./..O./△.△.'],
  },
  {
    id: 'sm-h1',
    difficulty: 'hard',
    constraintIds: ['sym-lr', 'no-adjacent-same', 'min-6'],
    examples: ['O..O/□..□/O..O/□..□', 'O..O/□..□/△..△/□..□'],
  },
  {
    id: 'sm-h2',
    difficulty: 'hard',
    constraintIds: ['exact-□-3', 'corners-filled', 'no-adjacent-same'],
    examples: ['O□.O/..□./.□../O..O', '△.□△/.□../..□./△..△'],
  },
  {
    id: 'sm-h3',
    difficulty: 'hard',
    constraintIds: ['sym-ud', 'center-empty', 'all-kinds'],
    examples: ['O□△O/△..△/△..△/O□△O', 'O..△/□.../□.../O..△'],
  },
]

export const getChallenge = (id: string): Challenge | undefined => CHALLENGES.find((c) => c.id === id)

export const challengeConstraints = (c: Challenge): Constraint[] =>
  c.constraintIds.map((id) => {
    const found = getConstraint(id)
    if (!found) throw new Error(`Unknown constraint id: ${id}`)
    return found
  })

export function pickChallenge(difficulty: Difficulty, rng: Rng): Challenge {
  const pool = CHALLENGES.filter((c) => c.difficulty === difficulty)
  return pool[randomInt(rng, 0, pool.length - 1)]
}

// ---- Board text ----------------------------------------------------------------

const isShape = (ch: string): ch is Shape => ch === '.' || ch === 'O' || ch === '□' || ch === '△'

/** "O.□△/..../..../...." (slashes optional) -> 16 shapes. Throws on a malformed board. */
export function parseBoard(text: string): Shape[] {
  const chars = [...text.replaceAll('/', '')]
  if (chars.length !== CELLS || !chars.every(isShape)) throw new Error(`Bad board text: ${text}`)
  return chars as Shape[]
}

export const shapesOf = (grid: readonly Cell[]): Shape[] => grid.map((c) => c.shape)

/** 16 shapes -> four row strings such as 'O.□△'. */
export function toRows(shapes: readonly Shape[]): string[] {
  return Array.from({ length: SIZE }, (_, r) => shapes.slice(r * SIZE, r * SIZE + SIZE).join(''))
}

export function checkAll(c: Challenge, shapes: readonly Shape[]): { id: string; label: string; met: boolean }[] {
  return challengeConstraints(c).map((k) => ({ id: k.id, label: k.label, met: k.check(shapes) }))
}

// ---- Output shape ----------------------------------------------------------------

export interface ShapeMixOutput {
  challengeId: string
  grid: Cell[]
  constraints: { id: string; label: string; met: boolean }[]
  edits: number
}
