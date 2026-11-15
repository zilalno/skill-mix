import type { EvalContext, Evaluation } from '../../types'
import { CELLS, SHAPE_CYCLE, getConstraint } from './challenges'
import type { Cell, Shape, ShapeMixOutput } from './challenges'

export type Measured = Record<string, number | string | boolean>

const isShape = (v: unknown): v is Shape => typeof v === 'string' && (SHAPE_CYCLE as readonly string[]).includes(v)

/** Accepts anything (a stage may submit null); always returns a 16-cell grid. */
export function normalizeOutput(output: unknown): ShapeMixOutput {
  const o = typeof output === 'object' && output !== null ? (output as Record<string, unknown>) : {}
  const rawGrid = Array.isArray(o.grid) ? o.grid : []
  const grid: Cell[] = Array.from({ length: CELLS }, (_, i) => {
    const c = (typeof rawGrid[i] === 'object' && rawGrid[i] !== null ? rawGrid[i] : {}) as Record<string, unknown>
    return { shape: isShape(c.shape) ? c.shape : '.', color: c.color === 'B' ? 'B' : 'A' }
  })
  const constraints = Array.isArray(o.constraints)
    ? o.constraints.flatMap((c) => {
        const r = (typeof c === 'object' && c !== null ? c : {}) as Record<string, unknown>
        return typeof r.id === 'string' && typeof r.label === 'string'
          ? [{ id: r.id, label: r.label, met: r.met === true }]
          : []
      })
    : []
  return {
    challengeId: typeof o.challengeId === 'string' ? o.challengeId : '',
    grid,
    constraints,
    edits: typeof o.edits === 'number' && Number.isFinite(o.edits) && o.edits >= 0 ? Math.floor(o.edits) : 0,
  }
}

/** Re-judges each condition from the grid itself; a condition id we do not know keeps its stored result. */
export function judge(output: ShapeMixOutput): ShapeMixOutput['constraints'] {
  const shapes = output.grid.map((c) => c.shape)
  return output.constraints.map((c) => {
    const known = getConstraint(c.id)
    return known ? { id: c.id, label: c.label, met: known.check(shapes) } : c
  })
}

/** App-computed numbers (PRD 7.4). No score and no aesthetic judgement. */
export function evaluateShapeMix(output: unknown, ctx?: EvalContext): Evaluation<Measured> {
  const normalized = normalizeOutput(output)
  const judged = judge(normalized)
  const shapes = normalized.grid.map((c) => c.shape)
  const countOf = (s: Shape) => shapes.filter((x) => x === s).length

  const measured: Measured = {
    constraintsMet: judged.filter((c) => c.met).length,
    constraintsTotal: judged.length,
    placed: shapes.filter((s) => s !== '.').length,
    circleCount: countOf('O'),
    squareCount: countOf('□'),
    triangleCount: countOf('△'),
    edits: normalized.edits,
    elapsedSec: ctx ? Math.round(ctx.elapsedMs / 1000) : 0,
  }

  const labels: Evaluation<Measured>['labels'] = [
    { key: 'constraintsMet', label: '충족한 조건', unit: `/ ${judged.length}` },
    { key: 'placed', label: '놓은 도형', unit: '개' },
    { key: 'circleCount', label: '○', unit: '개' },
    { key: 'squareCount', label: '□', unit: '개' },
    { key: 'triangleCount', label: '△', unit: '개' },
    { key: 'edits', label: '수정 횟수', unit: '번' },
    { key: 'elapsedSec', label: '소요 시간', unit: '초' },
  ]

  return { measured, labels }
}
