import type { EvalContext, Evaluation } from '../../types'
import { checkConstraint, countSentences, isWordUsed } from './data'
import type { WordWeaveOutput } from './data'

export type Measured = Record<string, number | string | boolean>

/** Accepts anything (a stage may submit null) and returns a well-formed output. */
export function normalizeOutput(output: unknown): WordWeaveOutput {
  const o = typeof output === 'object' && output !== null ? (output as Record<string, unknown>) : {}
  const words = Array.isArray(o.words) ? o.words.filter((w): w is string => typeof w === 'string') : []
  const text = typeof o.text === 'string' ? o.text : ''
  const constraints = Array.isArray(o.constraints)
    ? o.constraints.flatMap((c) => {
        const r = (typeof c === 'object' && c !== null ? c : {}) as Record<string, unknown>
        return typeof r.id === 'string' && typeof r.label === 'string' ? [{ id: r.id, label: r.label }] : []
      })
    : []
  return { words, text, constraints }
}

/** Which words appear in the text, and which are missing (PRD 7.3). */
export function matchWords(text: string, words: readonly string[]) {
  return {
    used: words.filter((w) => isWordUsed(text, w)),
    missing: words.filter((w) => !isWordUsed(text, w)),
  }
}

/**
 * App-computed numbers (PRD 7.3). No score: the open-ended quality is the AI's qualitative job.
 * `extraConstraintMet` is true when there is no extra condition (PRD 8.3 example).
 */
export function evaluateWordWeave(output: unknown, ctx?: EvalContext): Evaluation<Measured> {
  const { words, text, constraints } = normalizeOutput(output)
  const { used, missing } = matchWords(text, words)
  const hasExtra = constraints.length > 0
  const extraMet = constraints.every((c) => checkConstraint(c.id, text))

  const measured: Measured = {
    wordsUsed: used.length,
    wordsTotal: words.length,
    missingWords: missing.join(', '),
    chars: text.length,
    sentences: countSentences(text),
    hasExtraConstraint: hasExtra,
    extraConstraintMet: extraMet,
    elapsedSec: ctx ? Math.round(ctx.elapsedMs / 1000) : 0,
  }

  const labels: Evaluation<Measured>['labels'] = [
    { key: 'wordsUsed', label: '사용한 단어', unit: `/ ${words.length}개` },
    { key: 'chars', label: '글자 수', unit: '자' },
    { key: 'sentences', label: '문장 수', unit: '문장' },
    { key: 'elapsedSec', label: '소요 시간', unit: '초' },
  ]
  if (missing.length > 0) labels.splice(1, 0, { key: 'missingWords', label: '빠진 단어' })
  if (hasExtra) labels.splice(labels.length - 1, 0, { key: 'extraConstraintMet', label: '추가 조건' })

  return { measured, labels }
}
