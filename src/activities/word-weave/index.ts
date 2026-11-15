import type { ActivityDefinition } from '../../types'
import { MAX_CHARS, MAX_SENTENCES, TIME_LIMIT_SEC } from './data'
import type { WordWeaveOutput } from './data'
import { evaluateWordWeave } from './evaluate'
import type { Measured } from './evaluate'
import { RUBRIC, buildWordWeavePayload } from './payload'
import { WordWeaveStage } from './Stage'

export const wordWeave: ActivityDefinition<WordWeaveOutput, Measured> = {
  id: 'word-weave',
  name: 'WORD WEAVE',
  category: 'LANGUAGE',
  kind: 'open',
  tagline: '제시된 단어를 모두 엮어 짧은 글쓰기',
  rules: [
    `제시된 단어를 모두 사용해 ${TIME_LIMIT_SEC}초 안에 1~${MAX_SENTENCES}문장 작성`,
    `최대 ${MAX_CHARS}자 (HARD는 추가 조건 1개)`,
  ],
  estMinutes: 2,
  timeLimitSec: () => TIME_LIMIT_SEC,
  accent: '--flare',
  Stage: WordWeaveStage,
  evaluate: evaluateWordWeave,
  buildAiPayload: buildWordWeavePayload,
  rubric: RUBRIC,
  nextSuggestions: ['shape-mix', 'quick-think'],
}
