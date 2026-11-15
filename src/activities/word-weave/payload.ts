import type { AiActivityPayload, SessionCore } from '../../types'
import { checkConstraint } from './data'
import type { WordWeaveOutput } from './data'
import { normalizeOutput } from './evaluate'
import type { Measured } from './evaluate'

// Open-ended: qualitative criteria only, no scoring (PRD 7.3, 8.1).
export const RUBRIC = ['단어 간 연결', '의미의 명확성', '표현의 구체성', '문장 구성']

/** Sends the words, the text and each extra condition with its result. Nothing else. */
export function buildWordWeavePayload(s: SessionCore<WordWeaveOutput, Measured>): AiActivityPayload {
  const { words, text, constraints } = normalizeOutput(s.output)
  return {
    activityId: 'word-weave',
    activityName: 'WORD WEAVE',
    category: 'LANGUAGE',
    kind: 'open',
    difficulty: s.difficulty,
    conditions: [...s.conditions, ...constraints.map((c) => c.label)],
    elapsedSec: s.elapsedSec,
    measured: s.measured,
    userOutput: {
      words,
      text,
      constraints: constraints.map((c) => ({ label: c.label, met: checkConstraint(c.id, text) })),
    },
    rubric: RUBRIC,
    knownReference: null,
  }
}
