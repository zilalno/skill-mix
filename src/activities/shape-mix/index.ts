import type { ActivityDefinition } from '../../types'
import { TIME_LIMIT_SEC } from './challenges'
import type { ShapeMixOutput } from './challenges'
import { evaluateShapeMix } from './evaluate'
import type { Measured } from './evaluate'
import { RUBRIC, buildShapeMixPayload } from './payload'
import { ShapeMixStage } from './Stage'

export const shapeMix: ActivityDefinition<ShapeMixOutput, Measured> = {
  id: 'shape-mix',
  name: 'SHAPE MIX',
  category: 'SPATIAL',
  kind: 'open',
  tagline: '4×4 그리드에 조건 3개를 만족하는 도형 배치',
  rules: ['4×4 그리드에 도형을 배치해 조건 3개 충족하기', `${TIME_LIMIT_SEC}초, 언제든 제출 가능`],
  estMinutes: 2,
  timeLimitSec: () => TIME_LIMIT_SEC,
  accent: '--cobalt',
  Stage: ShapeMixStage,
  evaluate: evaluateShapeMix,
  buildAiPayload: buildShapeMixPayload,
  rubric: RUBRIC,
  nextSuggestions: ['word-weave', 'pattern-find'],
}
