import type { Difficulty } from '../../types'
import { shuffle } from '../random'
import type { Rng } from '../random'

// PATTERN FIND puzzle bank and selection (PRD 7.2).

/** Marks the missing item in a puzzle's `items`. */
export const BLANK = '?'
export const PUZZLE_COUNT = 5
export const RULE_MAX_CHARS = 60
export const TIME_LIMIT_SEC = 150

export type PuzzleKind =
  | 'arithmetic'
  | 'geometric'
  | 'alternating'
  | 'letter-shift'
  | 'rotation'
  | 'table'
  | 'progressive'

export interface PatternPuzzle {
  id: string
  difficulty: Difficulty
  kind: PuzzleKind
  prompt: string
  /** Sequence items, or table cells row by row when `columns` is set. Exactly one is BLANK. */
  items: string[]
  columns?: number
  /** Exactly four options. */
  choices: string[]
  answerIndex: number
  /** The rule the puzzle was built on (compared with the player's own wording by the analysis). */
  intendedRule: string
  /** What each option implies; '' for the correct option, a non-empty note for every wrong one. */
  distractorNotes: string[]
}

/** One played puzzle. PRD 7.2 fields; `picked` is a choice index or null when skipped. */
export interface PuzzleResult {
  id: string
  prompt: string
  choices: string[]
  picked: number | null
  correct: boolean
  ms: number
  ruleText?: string
}

export interface PatternFindOutput {
  puzzles: PuzzleResult[]
}

const SEQUENCE_PROMPT = '빈칸(?)에 들어갈 항목을 고르세요.'
const TABLE_PROMPT = '표의 빈칸(?)에 들어갈 항목을 고르세요.'

// Shape tokens are drawn by the Stage: circle|ring|square|box|tri|trio, optionally ":<degrees>".
export const PUZZLE_BANK: readonly PatternPuzzle[] = [
  // ---- EASY ----
  {
    id: 'pf-e1',
    difficulty: 'easy',
    kind: 'arithmetic',
    prompt: SEQUENCE_PROMPT,
    items: ['3', '7', '11', BLANK, '19'],
    choices: ['14', '13', '16', '15'],
    answerIndex: 3,
    intendedRule: '앞의 수에 4를 더한다(+4).',
    distractorNotes: [
      '+3씩 늘어난다고 본 경우(11+3)',
      '+2씩 늘어난다고 본 경우(11+2)',
      '+5씩 늘어난다고 본 경우(11+5)',
      '',
    ],
  },
  {
    id: 'pf-e2',
    difficulty: 'easy',
    kind: 'geometric',
    prompt: SEQUENCE_PROMPT,
    items: ['2', '4', '8', '16', BLANK],
    choices: ['24', '18', '32', '20'],
    answerIndex: 2,
    intendedRule: '앞의 수에 2를 곱한다(×2).',
    distractorNotes: [
      '마지막 증가폭 +8을 그대로 더한 경우(16+8)',
      '첫 증가폭 +2가 계속된다고 본 경우(16+2)',
      '',
      '+4씩 더한 경우(16+4)',
    ],
  },
  {
    id: 'pf-e3',
    difficulty: 'easy',
    kind: 'alternating',
    prompt: SEQUENCE_PROMPT,
    items: ['circle', 'square', 'circle', 'square', 'circle', BLANK],
    choices: ['circle', 'tri', 'square', 'box'],
    answerIndex: 2,
    intendedRule: '채운 원과 채운 네모가 번갈아 나온다.',
    distractorNotes: [
      '같은 도형이 반복된다고 본 경우',
      '규칙에 없는 새 도형을 고른 경우',
      '',
      '번갈아 나오는 점은 맞췄지만 속이 빈 모양을 고른 경우',
    ],
  },
  {
    id: 'pf-e4',
    difficulty: 'easy',
    kind: 'alternating',
    prompt: SEQUENCE_PROMPT,
    items: ['1', '10', '2', '20', '3', BLANK],
    choices: ['4', '30', '13', '33'],
    answerIndex: 1,
    intendedRule: '1, 2, 3처럼 1씩 커지는 수와 그 수의 10배(10, 20, …)가 번갈아 나온다.',
    distractorNotes: [
      '1씩 커지는 수열만 따라간 경우(3 다음 4)',
      '',
      '직전 수 3에 10을 더한 경우(3+10)',
      '3을 두 번 이어 쓴 경우',
    ],
  },
  {
    id: 'pf-e5',
    difficulty: 'easy',
    kind: 'letter-shift',
    prompt: SEQUENCE_PROMPT,
    items: ['A', 'C', 'E', 'G', BLANK],
    choices: ['H', 'I', 'J', 'K'],
    answerIndex: 1,
    intendedRule: '알파벳 순서로 2칸씩 이동한다.',
    distractorNotes: [
      '1칸씩 이동한다고 본 경우(G+1)',
      '',
      '3칸씩 이동한다고 본 경우(G+3)',
      '4칸씩 이동한다고 본 경우(G+4)',
    ],
  },

  // ---- NORMAL ----
  {
    id: 'pf-n1',
    difficulty: 'normal',
    kind: 'geometric',
    prompt: SEQUENCE_PROMPT,
    items: ['2', '6', '18', '54', BLANK],
    choices: ['108', '162', '72', '216'],
    answerIndex: 1,
    intendedRule: '앞의 수에 3을 곱한다(×3).',
    distractorNotes: [
      '×2를 적용한 경우(54×2)',
      '',
      '마지막 증가폭 +18을 그대로 더한 경우(54+18)',
      '곱하는 수가 계속 커진다고 본 경우(54×4)',
    ],
  },
  {
    id: 'pf-n2',
    difficulty: 'normal',
    kind: 'rotation',
    prompt: SEQUENCE_PROMPT,
    items: ['tri:0', 'tri:90', 'tri:180', BLANK],
    choices: ['tri:0', 'tri:90', 'tri:270', 'tri:180'],
    answerIndex: 2,
    intendedRule: '삼각형이 시계 방향으로 90°씩 돈다.',
    distractorNotes: [
      '한 바퀴를 다 돌아 처음 모양으로 돌아왔다고 본 경우',
      '두 번째 모양(90°)이 반복된다고 본 경우',
      '',
      '직전 모양을 그대로 반복한 경우',
    ],
  },
  {
    id: 'pf-n3',
    difficulty: 'normal',
    kind: 'alternating',
    prompt: SEQUENCE_PROMPT,
    items: ['5', '8', '6', '9', '7', BLANK],
    choices: ['10', '5', '9', '11'],
    answerIndex: 0,
    intendedRule: '+3과 −2가 번갈아 적용된다.',
    distractorNotes: [
      '',
      '직전 규칙(−2)을 한 번 더 적용한 경우(7−2)',
      '2씩 더한다고 본 경우(7+2)',
      '4씩 더한다고 본 경우(7+4)',
    ],
  },
  {
    id: 'pf-n4',
    difficulty: 'normal',
    kind: 'letter-shift',
    prompt: SEQUENCE_PROMPT,
    items: ['B', 'D', 'G', 'K', BLANK],
    choices: ['O', 'P', 'Q', 'N'],
    answerIndex: 1,
    intendedRule: '이동하는 칸 수가 2, 3, 4, 5로 하나씩 커진다.',
    distractorNotes: [
      '직전 이동 폭(+4)을 반복한 경우(K+4)',
      '',
      '이동 폭이 두 칸씩 커진다고 본 경우(K+6)',
      '직전 폭이 아니라 앞의 폭(+3)을 쓴 경우(K+3)',
    ],
  },
  {
    id: 'pf-n5',
    difficulty: 'normal',
    kind: 'table',
    prompt: TABLE_PROMPT,
    items: ['2', '3', '5', '4', '1', '5', '3', '6', BLANK],
    columns: 3,
    choices: ['3', '18', '7', '9'],
    answerIndex: 3,
    intendedRule: '각 줄에서 왼쪽 두 수를 더하면 오른쪽 수가 된다.',
    distractorNotes: [
      '두 수의 차(6−3)를 구한 경우',
      '두 수의 곱(3×6)을 구한 경우',
      '같은 줄이 아니라 위 칸(5)에 2를 더하는 식으로 이웃 칸만 본 경우',
      '',
    ],
  },

  // ---- HARD ----
  {
    id: 'pf-h1',
    difficulty: 'hard',
    kind: 'alternating',
    prompt: SEQUENCE_PROMPT,
    items: ['2', '3', '6', '7', '14', BLANK],
    choices: ['15', '28', '16', '21'],
    answerIndex: 0,
    intendedRule: '+1과 ×2가 번갈아 적용된다.',
    distractorNotes: [
      '',
      '×2만 계속 적용한 경우(14×2)',
      '+2를 적용한 경우(14+2)',
      '앞의 두 수를 더한 경우(7+14)',
    ],
  },
  {
    id: 'pf-h2',
    difficulty: 'hard',
    kind: 'progressive',
    prompt: SEQUENCE_PROMPT,
    items: ['1', '2', '6', '24', BLANK],
    choices: ['25', '120', '96', '48'],
    answerIndex: 1,
    intendedRule: '곱하는 수가 2, 3, 4, 5로 하나씩 커진다.',
    distractorNotes: [
      '직전 수에 1을 더한 경우(24+1)',
      '',
      '직전 곱(×4)을 한 번 더 적용한 경우(24×4)',
      '×2를 계속 곱한 경우(24×2)',
    ],
  },
  {
    id: 'pf-h3',
    difficulty: 'hard',
    kind: 'rotation',
    prompt: SEQUENCE_PROMPT,
    items: ['tri:0', 'trio:90', 'tri:180', 'trio:270', BLANK],
    choices: ['trio:0', 'tri:0', 'tri:90', 'trio:270'],
    answerIndex: 1,
    intendedRule: '90°씩 돌면서 채운 삼각형과 속이 빈 삼각형이 번갈아 나온다.',
    distractorNotes: [
      '회전은 맞췄지만 채움이 번갈아 바뀐다는 점을 놓친 경우',
      '',
      '채움은 맞췄지만 90°만 돌았다고 본 경우',
      '직전 모양을 그대로 반복한 경우',
    ],
  },
  {
    id: 'pf-h4',
    difficulty: 'hard',
    kind: 'table',
    prompt: TABLE_PROMPT,
    items: ['2', '4', '8', '3', '9', '27', '5', '25', BLANK],
    columns: 3,
    choices: ['50', '75', '30', '125'],
    answerIndex: 3,
    intendedRule: '각 줄은 첫 수, 그 수의 제곱, 그 수의 세제곱이다.',
    distractorNotes: [
      '25에 2를 곱한 경우(첫 줄의 비율만 본 경우)',
      '25에 3을 곱한 경우(둘째 줄의 비율을 가져온 경우)',
      '5와 25를 더한 경우',
      '',
    ],
  },
  {
    id: 'pf-h5',
    difficulty: 'hard',
    kind: 'letter-shift',
    prompt: SEQUENCE_PROMPT,
    items: ['A', 'Z', 'B', 'Y', 'C', BLANK],
    choices: ['D', 'W', 'X', 'Z'],
    answerIndex: 2,
    intendedRule: '앞에서 시작하는 글자(A, B, C…)와 뒤에서 시작하는 글자(Z, Y, X…)가 번갈아 나온다.',
    distractorNotes: [
      '앞에서 시작하는 줄(A, B, C)의 다음 글자만 이어 본 경우',
      '뒤에서 시작하는 줄을 두 칸씩 이동한다고 본 경우(Y−2)',
      '',
      '처음의 Z가 다시 나온다고 본 경우',
    ],
  },
]

export const getPuzzle = (id: string): PatternPuzzle | undefined => PUZZLE_BANK.find((p) => p.id === id)

export const isPuzzleCorrect = (puzzle: PatternPuzzle, picked: number | null): boolean =>
  picked !== null && picked === puzzle.answerIndex

const RANK: Record<Difficulty, number> = { easy: 0, normal: 1, hard: 2 }

/**
 * Picks `count` distinct puzzles for a session: at least three of the chosen difficulty, the rest
 * from that difficulty or its neighbours, in random order. Same rng -> same selection.
 */
export function selectPuzzles(difficulty: Difficulty, rng: Rng, count = PUZZLE_COUNT): PatternPuzzle[] {
  const own = PUZZLE_BANK.filter((p) => p.difficulty === difficulty)
  const near = PUZZLE_BANK.filter((p) => Math.abs(RANK[p.difficulty] - RANK[difficulty]) === 1)

  const core = shuffle(own, rng).slice(0, Math.min(3, own.length, count))
  const taken = new Set(core.map((p) => p.id))
  const pool = shuffle(
    [...own, ...near].filter((p) => !taken.has(p.id)),
    rng,
  )
  return shuffle([...core, ...pool.slice(0, count - core.length)], rng)
}

/** Builds the submitted output from the Stage's live state. Missing entries read as skipped. */
export function buildResults(
  puzzles: readonly PatternPuzzle[],
  picks: ReadonlyArray<number | null>,
  rules: readonly string[],
  spentMs: readonly number[],
): PuzzleResult[] {
  return puzzles.map((p, i) => {
    const picked = picks[i] ?? null
    const rule = (rules[i] ?? '').trim().slice(0, RULE_MAX_CHARS)
    const spent = spentMs[i] ?? 0
    return {
      id: p.id,
      prompt: p.prompt,
      choices: [...p.choices],
      picked,
      correct: isPuzzleCorrect(p, picked),
      // a non-finite time would make evaluate() discard the whole row, so it is stored as 0
      ms: Number.isFinite(spent) ? Math.max(0, Math.round(spent)) : 0,
      ...(rule ? { ruleText: rule } : {}),
    }
  })
}

// ---- Token text (used for accessibility labels and the AI payload) ----

const SHAPE_NAME: Record<string, string> = {
  circle: '채운 원',
  ring: '속 빈 원',
  square: '채운 네모',
  box: '속 빈 네모',
  tri: '채운 삼각형',
  trio: '속 빈 삼각형',
}

export function parseShape(value: string): { shape: string; deg: number } | null {
  const m = /^(circle|ring|square|box|tri|trio)(?::(\d{1,3}))?$/.exec(value)
  return m ? { shape: m[1], deg: m[2] ? Number(m[2]) : 0 } : null
}

/** Plain-text description of one item: "채운 삼각형 90°", "빈칸(?)", or the item itself. */
export function tokenText(value: string): string {
  if (value === BLANK) return '빈칸(?)'
  const shape = parseShape(value)
  if (!shape) return value
  const turned = shape.shape === 'tri' || shape.shape === 'trio'
  return turned ? `${SHAPE_NAME[shape.shape]} ${shape.deg}°` : SHAPE_NAME[shape.shape]
}

/** The puzzle as one line of text; tables are written row by row, rows separated by " / ". */
export function sequenceText(puzzle: PatternPuzzle): string {
  const cells = puzzle.items.map(tokenText)
  const cols = puzzle.columns
  if (!cols) return cells.join(', ')
  const rows: string[] = []
  for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols).join(', '))
  return rows.join(' / ')
}
