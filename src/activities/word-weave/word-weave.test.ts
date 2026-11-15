import { describe, expect, it } from 'vitest'
import { validateAnalyzeRequest } from '../../../api/_lib/validate'
import type { Difficulty, SessionCore } from '../../types'
import { mulberry32 } from '../random'
import {
  CONSTRAINTS,
  WORD_COUNT,
  WORD_SETS,
  checkConstraint,
  countSentences,
  isWordUsed,
  pickConstraints,
  pickWords,
  splitSentences,
} from './data'
import type { WordWeaveOutput } from './data'
import { evaluateWordWeave, matchWords } from './evaluate'
import type { Measured } from './evaluate'
import { wordWeave } from './index'
import { buildWordWeavePayload } from './payload'

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']

describe('word sets', () => {
  it.each(DIFFICULTIES)('%s: sets have the right size, with no duplicates or overlapping words', (d) => {
    expect(WORD_SETS[d].length).toBeGreaterThanOrEqual(4)
    for (const set of WORD_SETS[d]) {
      expect(set).toHaveLength(WORD_COUNT[d])
      expect(new Set(set).size).toBe(set.length)
      for (const a of set) for (const b of set) if (a !== b) expect(a.includes(b)).toBe(false)
    }
  })

  it('uses 4 / 5 / 6 words', () => {
    expect(WORD_COUNT).toEqual({ easy: 4, normal: 5, hard: 6 })
  })

  it('pickWords returns a whole set, in any order', () => {
    const words = pickWords('normal', mulberry32(7))
    expect(WORD_SETS.normal.some((s) => [...s].sort().join() === [...words].sort().join())).toBe(true)
  })
})

describe('extra condition (HARD only)', () => {
  it('easy and normal have none', () => {
    expect(pickConstraints('easy', mulberry32(1))).toEqual([])
    expect(pickConstraints('normal', mulberry32(1))).toEqual([])
  })

  it('hard gets exactly one, and both kinds show up across seeds', () => {
    const ids = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      const picked = pickConstraints('hard', mulberry32(seed))
      expect(picked).toHaveLength(1)
      ids.add(picked[0].id)
    }
    expect(ids).toEqual(new Set(CONSTRAINTS.map((c) => c.id)))
  })
})

describe('word matching', () => {
  it('matches a bare word', () => {
    expect(isWordUsed('우산을 챙겼다', '우산')).toBe(true)
  })
  it.each([
    ['우산을 들고 나갔다', '우산'],
    ['고양이가 계단을 올랐다', '고양이'],
    ['편지에는 아무 말도 없었다', '편지'],
  ])('allows a particle: %s', (text, word) => {
    expect(isWordUsed(text, word)).toBe(true)
  })
  it('does not match a missing word, and never matches the empty word', () => {
    expect(isWordUsed('우산을 챙겼다', '고양이')).toBe(false)
    expect(isWordUsed('아무 글', '')).toBe(false)
  })
  it('splits used and missing, keeping the shown order', () => {
    const r = matchWords('새벽에 우산을 들었다', ['우산', '새벽', '고양이'])
    expect(r.used).toEqual(['우산', '새벽'])
    expect(r.missing).toEqual(['고양이'])
  })
})

describe('sentence count', () => {
  it.each([
    ['', 0],
    ['   ', 0],
    ['한 문장', 1],
    ['하나. 둘', 2],
    ['하나. 둘? 셋!', 3],
    ['정말?! 그래...', 2],
    ['값은 3.5였다. 끝', 2],
    ['...', 0],
  ])('%j -> %i', (text, n) => {
    expect(countSentences(text)).toBe(n)
  })

  it('keeps the closing punctuation of each sentence', () => {
    expect(splitSentences('가나. 다라?')).toEqual([
      { body: '가나', end: '.' },
      { body: '다라', end: '?' },
    ])
  })
})

describe('extra condition checks', () => {
  it('question: needs a sentence that ends with ?', () => {
    expect(checkConstraint('question', '우산이 어디 있지? 찾았다.')).toBe(true)
    expect(checkConstraint('question', '우산을 찾았다.')).toBe(false)
    expect(checkConstraint('question', '정말 있을까요')).toBe(false)
    expect(checkConstraint('question', '')).toBe(false)
  })
  it('last-short: the last sentence is 10 characters or fewer', () => {
    expect(checkConstraint('last-short', '긴 문장이 먼저 길게 이어졌다. 끝났다.')).toBe(true)
    expect(checkConstraint('last-short', '가나다라마바사아자차.')).toBe(true) // exactly 10
    expect(checkConstraint('last-short', '가나다라마바사아자차카.')).toBe(false) // 11
    expect(checkConstraint('last-short', '짧다. 그런데 마지막 문장이 열 글자를 훌쩍 넘는다.')).toBe(false)
    expect(checkConstraint('last-short', '')).toBe(false)
  })
  it('an unknown id is never met', () => {
    expect(checkConstraint('nope', '글')).toBe(false)
  })
})

const output = (over: Partial<WordWeaveOutput> = {}): WordWeaveOutput => ({
  words: ['우산', '새벽', '고양이', '계단', '편지'],
  text: '새벽에 우산을 든 고양이가 계단을 올랐다. 편지는 젖지 않았다.',
  constraints: [],
  ...over,
})

describe('evaluateWordWeave', () => {
  it('counts words, chars, sentences and time', () => {
    const { measured } = evaluateWordWeave(output(), { difficulty: 'normal', elapsedMs: 64_400, timedOut: false })
    expect(measured).toMatchObject({
      wordsUsed: 5,
      wordsTotal: 5,
      missingWords: '',
      chars: output().text.length,
      sentences: 2,
      hasExtraConstraint: false,
      extraConstraintMet: true,
      elapsedSec: 64,
    })
  })

  it('lists missing words', () => {
    const { measured, labels } = evaluateWordWeave(output({ text: '새벽에 우산을 들었다.' }))
    expect(measured.wordsUsed).toBe(2)
    expect(measured.missingWords).toBe('고양이, 계단, 편지')
    expect(labels.some((l) => l.key === 'missingWords')).toBe(true)
  })

  it('judges the extra condition from the text itself', () => {
    const c = [{ id: 'question', label: '물음표' }]
    expect(evaluateWordWeave(output({ constraints: c })).measured.extraConstraintMet).toBe(false)
    const asked = evaluateWordWeave(output({ constraints: c, text: '우산은 어디 있지? 새벽이다.' }))
    expect(asked.measured).toMatchObject({ hasExtraConstraint: true, extraConstraintMet: true })
    expect(asked.labels.some((l) => l.key === 'extraConstraintMet')).toBe(true)
  })

  it.each([null, undefined, 'x', 42, {}, { words: 'no', text: 5, constraints: 'no' }])('is total for %j', (bad) => {
    const { measured } = evaluateWordWeave(bad)
    expect(measured).toMatchObject({ wordsUsed: 0, wordsTotal: 0, chars: 0, sentences: 0 })
    for (const v of Object.values(measured)) expect(typeof v === 'number' ? Number.isNaN(v) : false).toBe(false)
  })

  it('has no score field', () => {
    const keys = Object.keys(evaluateWordWeave(output()).measured)
    expect(keys.some((k) => /score|point|rating/i.test(k))).toBe(false)
  })
})

describe('buildWordWeavePayload', () => {
  const out = output({ constraints: [{ id: 'question', label: '물음표(?)로 끝나는 문장을 하나 포함하기' }] })
  const core: SessionCore<WordWeaveOutput, Measured> = {
    id: 's1',
    activityId: 'word-weave',
    difficulty: 'hard',
    conditions: ['제한 시간 90초'],
    elapsedSec: 64,
    timedOut: false,
    output: out,
    measured: evaluateWordWeave(out).measured,
  }
  const payload = buildWordWeavePayload(core)

  it('passes the server request validation', () => {
    expect(validateAnalyzeRequest(payload).ok).toBe(true)
  })
  it('sends words, text and condition results only', () => {
    expect(payload.userOutput).toEqual({
      words: out.words,
      text: out.text,
      constraints: [{ label: out.constraints[0].label, met: false }],
    })
    expect(payload.conditions).toContain(out.constraints[0].label)
    expect(payload.knownReference).toBeNull()
  })
})

describe('activity definition', () => {
  it('uses the flare accent, 90s and an open-ended rubric', () => {
    expect(wordWeave.accent).toBe('--flare')
    expect(wordWeave.kind).toBe('open')
    expect(DIFFICULTIES.map((d) => wordWeave.timeLimitSec(d))).toEqual([90, 90, 90])
    expect(wordWeave.rubric).toEqual(['단어 간 연결', '의미의 명확성', '표현의 구체성', '문장 구성'])
  })
})
