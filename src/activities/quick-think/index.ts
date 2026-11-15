import type { ActivityDefinition } from '../../types'
import { TIME_LIMIT_SEC } from './data'
import type { QuickThinkOutput } from './data'
import { evaluateQuickThink } from './evaluate'
import type { Measured } from './evaluate'
import { RUBRIC, buildQuickThinkPayload } from './payload'
import { QuickThinkStage } from './Stage'

export const quickThink: ActivityDefinition<QuickThinkOutput, Measured> = {
  id: 'quick-think',
  name: 'QUICK THINK',
  category: 'CALC',
  kind: 'objective',
  tagline: '60초 안에 암산 문제를 최대한 많이 풀기',
  rules: ['60초 동안 암산 문제를 최대한 풀기', 'Enter로 제출, 오답이어도 다음 문제로 진행'],
  estMinutes: 1,
  timeLimitSec: () => TIME_LIMIT_SEC,
  accent: '--acid',
  Stage: QuickThinkStage,
  evaluate: evaluateQuickThink,
  buildAiPayload: buildQuickThinkPayload,
  rubric: RUBRIC,
  nextSuggestions: ['pattern-find', 'word-weave'],
}
