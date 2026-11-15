import { createElement } from 'react'
import type { ActivityDefinition, ActivityId } from '../types'

// Registry holds heterogeneous activities (each with its own output type O),
// so entries are stored as ActivityDefinition<any, any>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyActivity = ActivityDefinition<any, any>

const ComingSoon = () => createElement('p', null, 'COMING SOON')

const todo = (what: string) => () => {
  throw new Error(`TODO: ${what}`)
}

export const ACTIVITIES: AnyActivity[] = [
  {
    id: 'quick-think',
    name: 'QUICK THINK',
    category: 'CALC',
    kind: 'objective',
    tagline: '60초 안에 암산 문제를 최대한 많이 풀기',
    rules: ['60초 동안 암산 문제를 최대한 풀기', 'Enter로 제출, 오답이어도 다음 문제로 진행'],
    estMinutes: 1,
    timeLimitSec: () => 60,
    accent: '--acid',
    Stage: ComingSoon,
    evaluate: todo('quick-think evaluate'),
    buildAiPayload: todo('quick-think buildAiPayload'),
    rubric: [], // TODO: quick-think owner (PRD 7.1)
    nextSuggestions: [],
  },
  {
    id: 'pattern-find',
    name: 'PATTERN FIND',
    category: 'LOGIC',
    kind: 'hybrid',
    tagline: '빈칸에 들어갈 규칙을 찾아내기',
    rules: ['5문제, 총 150초', '4지선다로 빈칸을 고르고, 발견한 규칙을 한 줄(최대 60자)로 적을 수 있음'],
    estMinutes: 3,
    timeLimitSec: () => 150,
    accent: '--bubble',
    Stage: ComingSoon,
    evaluate: todo('pattern-find evaluate'),
    buildAiPayload: todo('pattern-find buildAiPayload'),
    rubric: [], // TODO: pattern-find owner (PRD 7.2)
    nextSuggestions: [],
  },
  {
    id: 'word-weave',
    name: 'WORD WEAVE',
    category: 'LANGUAGE',
    kind: 'open',
    tagline: '제시된 단어를 모두 엮어 짧은 글쓰기',
    rules: ['제시된 단어를 모두 사용해 90초 안에 1~3문장 작성', '최대 200자'],
    estMinutes: 2,
    timeLimitSec: () => 90,
    accent: '--flare',
    Stage: ComingSoon,
    evaluate: todo('word-weave evaluate'),
    buildAiPayload: todo('word-weave buildAiPayload'),
    rubric: ['단어 간 연결', '의미의 명확성', '표현의 구체성', '문장 구성'], // PRD 8.3
    nextSuggestions: [],
  },
  {
    id: 'shape-mix',
    name: 'SHAPE MIX',
    category: 'SPATIAL',
    kind: 'open',
    tagline: '4×4 그리드에 조건 3개를 만족하는 도형 배치',
    rules: ['4×4 그리드에 도형을 배치해 조건 3개 충족하기', '120초, 언제든 제출 가능'],
    estMinutes: 2,
    timeLimitSec: () => 120,
    accent: '--cobalt',
    Stage: ComingSoon,
    evaluate: todo('shape-mix evaluate'),
    buildAiPayload: todo('shape-mix buildAiPayload'),
    rubric: [], // TODO: shape-mix owner (PRD 7.4)
    nextSuggestions: [],
  },
]

/** Accepts any string (it comes from the URL); returns undefined for unknown ids. */
export function getActivity(id: string): AnyActivity | undefined {
  return ACTIVITIES.find((a) => a.id === (id as ActivityId))
}
