import { describe, expect, it } from 'vitest'
import { parseFeedback, stripCodeFence, validateFeedback } from './feedback.js'

const valid = () => ({
  summary: '이번 시도에서는 다섯 단어를 모두 사용하셨어요.',
  observedPoints: ['"새벽"과 "계단"이 한 문장에서 이어졌어요.', '두 번째 문장은 짧게 마무리됐어요.'],
  strengths: [{ point: '단어 연결', evidence: '"새벽 계단 아래" 표현' }],
  improvementTip: '다음에는 장면의 소리나 냄새를 한 가지 더해 보세요.',
  nextChallenge: { title: 'SHAPE MIX 해 보기', reason: '언어 외 표현도 시도해 볼 수 있어요.', activityId: 'shape-mix' },
})

const json = (v: unknown) => JSON.stringify(v)

describe('stripCodeFence', () => {
  it('removes a ```json fence', () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })
  it('removes a bare ``` fence and surrounding whitespace', () => {
    expect(stripCodeFence('  ```\n{"a":1}\n```  \n')).toBe('{"a":1}')
  })
  it('leaves unfenced text alone', () => {
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}')
  })
})

describe('parseFeedback', () => {
  it('accepts a valid response', () => {
    const r = parseFeedback(json(valid()))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.feedback).toEqual(valid())
  })

  it('accepts a response wrapped in a code fence', () => {
    const r = parseFeedback('```json\n' + json(valid()) + '\n```')
    expect(r.ok).toBe(true)
  })

  it('fails on non-JSON text', () => {
    expect(parseFeedback('죄송합니다, 분석할 수 없어요.')).toEqual({ ok: false, reason: 'not json' })
  })

  it('fails when prose surrounds the fence (only one parse attempt)', () => {
    expect(parseFeedback('결과입니다:\n```json\n' + json(valid()) + '\n```').ok).toBe(false)
  })

  it('strips unknown extra keys instead of passing them through', () => {
    const r = parseFeedback(json({ ...valid(), score: 99 }))
    expect(r.ok).toBe(true)
    if (r.ok) expect('score' in r.feedback).toBe(false)
  })
})

describe('validateFeedback: missing keys fail, nothing is invented', () => {
  it.each(['summary', 'observedPoints', 'strengths', 'improvementTip', 'nextChallenge'])('missing %s', (key) => {
    const v: Record<string, unknown> = valid()
    delete v[key]
    const r = validateFeedback(v)
    expect(r.ok).toBe(false)
  })

  it.each(['title', 'reason', 'activityId'])('missing nextChallenge.%s', (key) => {
    const v = valid()
    delete (v.nextChallenge as Record<string, unknown>)[key]
    expect(validateFeedback(v).ok).toBe(false)
  })

  it('missing strengths evidence', () => {
    const v = valid()
    v.strengths = [{ point: '단어 연결' } as never]
    expect(validateFeedback(v).ok).toBe(false)
  })
})

describe('validateFeedback: wrong types fail', () => {
  it('summary must be a string', () => {
    expect(validateFeedback({ ...valid(), summary: 42 }).ok).toBe(false)
  })
  it('observedPoints must be an array of strings', () => {
    expect(validateFeedback({ ...valid(), observedPoints: '하나' }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), observedPoints: ['가', 3] }).ok).toBe(false)
  })
  it('strengths items must be objects', () => {
    expect(validateFeedback({ ...valid(), strengths: ['단어 연결'] }).ok).toBe(false)
  })
  it('nextChallenge must be an object', () => {
    expect(validateFeedback({ ...valid(), nextChallenge: 'shape-mix' }).ok).toBe(false)
  })
  it('rejects empty or blank strings', () => {
    expect(validateFeedback({ ...valid(), summary: '   ' }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), improvementTip: '' }).ok).toBe(false)
  })
  it('rejects non-objects', () => {
    expect(validateFeedback(null).ok).toBe(false)
    expect(validateFeedback([]).ok).toBe(false)
    expect(validateFeedback('x').ok).toBe(false)
  })
})

describe('validateFeedback: length limits', () => {
  const long = 'a'.repeat(301)
  it('accepts exactly 300 characters', () => {
    expect(validateFeedback({ ...valid(), summary: 'a'.repeat(300) }).ok).toBe(true)
  })
  it('rejects a string over 300 characters in each place', () => {
    expect(validateFeedback({ ...valid(), summary: long }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), improvementTip: long }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), observedPoints: [long, '둘'] }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), strengths: [{ point: long, evidence: '근거' }] }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), strengths: [{ point: '점', evidence: long }] }).ok).toBe(false)
    const v = valid()
    v.nextChallenge.title = long
    expect(validateFeedback(v).ok).toBe(false)
  })
  it('enforces observedPoints 2..4', () => {
    expect(validateFeedback({ ...valid(), observedPoints: ['하나'] }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), observedPoints: ['1', '2', '3', '4'] }).ok).toBe(true)
    expect(validateFeedback({ ...valid(), observedPoints: ['1', '2', '3', '4', '5'] }).ok).toBe(false)
  })
  it('enforces strengths 1..3', () => {
    const s = { point: '점', evidence: '근거' }
    expect(validateFeedback({ ...valid(), strengths: [] }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), strengths: [s, s, s] }).ok).toBe(true)
    expect(validateFeedback({ ...valid(), strengths: [s, s, s, s] }).ok).toBe(false)
  })
})

describe('validateFeedback: nextChallenge.activityId', () => {
  const withId = (activityId: unknown) => {
    const v = valid()
    v.nextChallenge = { ...v.nextChallenge, activityId } as never
    return validateFeedback(v)
  }

  it.each(['quick-think', 'pattern-find', 'word-weave', 'shape-mix'])('keeps allowed id %s', (id) => {
    const r = withId(id)
    expect(r.ok && r.feedback.nextChallenge.activityId).toBe(id)
  })

  it('keeps an explicit null', () => {
    const r = withId(null)
    expect(r.ok && r.feedback.nextChallenge.activityId).toBeNull()
  })

  it.each(['key-summary', 'SHAPE-MIX', '', 'quick-think | null', 7, {}, false])(
    'replaces disallowed id %j with null (not a failure)',
    (id) => {
      const r = withId(id)
      expect(r.ok).toBe(true)
      expect(r.ok && r.feedback.nextChallenge.activityId).toBeNull()
    },
  )
})

describe('validateFeedback: Korean only', () => {
  it('rejects a Chinese answer', () => {
    expect(validateFeedback({ ...valid(), summary: '用户在4次尝试中答对3题。' }).ok).toBe(false)
  })
  it('rejects a single Han ideograph leaked into a Korean sentence, in every place', () => {
    const leak = '정답率는 높습니다.'
    expect(validateFeedback({ ...valid(), summary: leak }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), observedPoints: [leak, '두 번째 관찰입니다.'] }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), strengths: [{ point: '연결', evidence: leak }] }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), improvementTip: leak }).ok).toBe(false)
    expect(validateFeedback({ ...valid(), nextChallenge: { ...valid().nextChallenge, reason: leak } }).ok).toBe(false)
  })
  it('rejects Japanese kana', () => {
    expect(validateFeedback({ ...valid(), summary: 'これは日本語です。' }).ok).toBe(false)
  })
  it('still accepts Korean with digits, Latin names, symbols and quotes', () => {
    expect(validateFeedback({ ...valid(), summary: 'QUICK THINK 12문제 중 9개(75%) 정답 · 14 × 6 = 84 “인용”.' }).ok).toBe(true)
  })
})
