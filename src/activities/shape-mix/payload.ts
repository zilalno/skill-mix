import type { AiActivityPayload, SessionCore } from '../../types'
import { shapesOf, toRows } from './challenges'
import type { ShapeMixOutput } from './challenges'
import { judge, normalizeOutput } from './evaluate'
import type { Measured } from './evaluate'

// Open-ended: qualitative criteria only, no scoring (PRD 7.4, 8.1).
export const RUBRIC = ['조건을 충족한 방식(대칭·분산·군집 등)', '미충족 조건의 원인', '다른 배치 아이디어']

/**
 * The grid goes out as four row strings ('O.□△'), row 1 on top, column 1 on the left, so the
 * analysis can point at positions. Colours are decoration and are not sent.
 */
export function buildShapeMixPayload(s: SessionCore<ShapeMixOutput, Measured>): AiActivityPayload {
  const out = normalizeOutput(s.output)
  const judged = judge(out)
  return {
    activityId: 'shape-mix',
    activityName: 'SHAPE MIX',
    category: 'SPATIAL',
    kind: 'open',
    difficulty: s.difficulty,
    conditions: [...s.conditions, ...judged.map((c) => c.label)],
    elapsedSec: s.elapsedSec,
    measured: s.measured,
    userOutput: {
      challengeId: out.challengeId,
      grid: toRows(shapesOf(out.grid)),
      constraints: judged.map((c) => ({ label: c.label, met: c.met })),
      edits: out.edits,
    },
    rubric: RUBRIC,
    knownReference: null,
  }
}
