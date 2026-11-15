import type { ActivityDefinition } from '../../types'
import { TIME_LIMIT_SEC } from './data'
import type { PatternFindOutput } from './data'
import { evaluatePatternFind } from './evaluate'
import type { Measured } from './evaluate'
import { RUBRIC, buildPatternFindPayload } from './payload'
import { PatternFindStage } from './Stage'

export const patternFind: ActivityDefinition<PatternFindOutput, Measured> = {
  id: 'pattern-find',
  name: 'PATTERN FIND',
  category: 'LOGIC',
  kind: 'hybrid',
  tagline: '빈칸에 들어갈 규칙을 찾아내기',
  rules: ['5문제, 총 150초', '4지선다로 빈칸을 고르고, 발견한 규칙을 한 줄(최대 60자)로 적을 수 있음'],
  estMinutes: 3,
  timeLimitSec: () => TIME_LIMIT_SEC,
  accent: '--bubble',
  Stage: PatternFindStage,
  evaluate: evaluatePatternFind,
  buildAiPayload: buildPatternFindPayload,
  rubric: RUBRIC,
  nextSuggestions: ['word-weave', 'shape-mix'],
}
