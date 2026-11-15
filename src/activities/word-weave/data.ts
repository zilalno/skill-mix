import type { Difficulty } from '../../types'
import { randomInt, shuffle } from '../random'
import type { Rng } from '../random'

export const TIME_LIMIT_SEC = 90
export const MAX_CHARS = 200
export const MAX_SENTENCES = 3
export const SHORT_LAST_SENTENCE_CHARS = 10

export const WORD_COUNT: Record<Difficulty, number> = { easy: 4, normal: 5, hard: 6 }

/**
 * Word sets (nouns). Within a set no word repeats and no word contains another, so one
 * stretch of text can never satisfy two chips at once.
 */
export const WORD_SETS: Record<Difficulty, readonly (readonly string[])[]> = {
  easy: [
    ['우산', '고양이', '계단', '편지'],
    ['바다', '모자', '시계', '기차'],
    ['사과', '창문', '자전거', '노래'],
    ['구름', '신발', '도서관', '강아지'],
    ['커피', '달력', '공원', '비행기'],
  ],
  normal: [
    ['우산', '새벽', '고양이', '계단', '편지'],
    ['등대', '열쇠', '안개', '소포', '시장'],
    ['지도', '모래', '풍선', '엘리베이터', '라디오'],
    ['호수', '촛불', '자전거', '일기장', '낙엽'],
    ['놀이터', '사진', '눈사람', '버스', '도시락'],
  ],
  hard: [
    ['우산', '새벽', '고양이', '계단', '편지', '거울'],
    ['등대', '열쇠', '안개', '소포', '시장', '주머니'],
    ['지도', '모래', '풍선', '라디오', '기차역', '그림자'],
    ['호수', '촛불', '일기장', '낙엽', '다리', '우체통'],
    ['놀이터', '사진', '눈사람', '도시락', '이어폰', '무지개'],
  ],
}

// ---- Extra conditions (HARD only) -------------------------------------------

export type ConstraintId = 'question' | 'last-short'

export interface ConstraintDef {
  id: ConstraintId
  label: string
}

export const CONSTRAINTS: readonly ConstraintDef[] = [
  { id: 'question', label: '물음표(?)로 끝나는 문장을 하나 포함하기' },
  { id: 'last-short', label: `마지막 문장은 ${SHORT_LAST_SENTENCE_CHARS}자 이내로 쓰기` },
]

/** EASY and NORMAL have no extra condition; HARD gets one at random. */
export function pickConstraints(difficulty: Difficulty, rng: Rng): ConstraintDef[] {
  if (difficulty !== 'hard') return []
  return [CONSTRAINTS[randomInt(rng, 0, CONSTRAINTS.length - 1)]]
}

export function pickWords(difficulty: Difficulty, rng: Rng): string[] {
  const sets = WORD_SETS[difficulty]
  return shuffle(sets[randomInt(rng, 0, sets.length - 1)], rng)
}

// ---- Text analysis (pure) ----------------------------------------------------

/** Substring match on purpose: Korean particles attach to nouns ("우산을", "고양이가"). */
export const isWordUsed = (text: string, word: string): boolean => word !== '' && text.includes(word)

const DECIMAL_DOT = '\u0000'

export interface Sentence {
  /** Sentence body without its closing punctuation, trimmed. */
  body: string
  /** The closing punctuation run (". ? !"), empty when the text just ends. */
  end: string
}

/** A sentence ends at . ? ! (a dot between two digits, like 3.5, is not an ending). */
export function splitSentences(text: string): Sentence[] {
  const protectedText = text.replace(/(\d)\.(?=\d)/g, `$1${DECIMAL_DOT}`)
  const parts = protectedText.match(/[^.?!]*[.?!]+|[^.?!]+$/g) ?? []
  const out: Sentence[] = []
  for (const part of parts) {
    const m = /^([^.?!]*)([.?!]*)$/.exec(part)
    if (!m) continue
    const body = m[1].replaceAll(DECIMAL_DOT, '.').trim()
    if (body === '') continue
    out.push({ body, end: m[2] })
  }
  return out
}

export const countSentences = (text: string): number => splitSentences(text).length

export function checkConstraint(id: string, text: string): boolean {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return false
  if (id === 'question') return sentences.some((s) => s.end.includes('?'))
  if (id === 'last-short') return sentences[sentences.length - 1].body.length <= SHORT_LAST_SENTENCE_CHARS
  return false
}

// ---- Output shape ------------------------------------------------------------

export interface WordWeaveOutput {
  words: string[]
  text: string
  constraints: { id: string; label: string }[]
}
