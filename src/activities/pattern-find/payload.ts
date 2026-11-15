import type { AiActivityPayload, SessionCore } from '../../types'
import { getPuzzle, sequenceText, tokenText } from './data'
import type { PatternFindOutput } from './data'
import { normalizePuzzles } from './evaluate'
import type { Measured } from './evaluate'

export const RUBRIC = [
  '정답률은 수치 그대로 인용',
  '규칙 서술과 의도된 규칙의 비교',
  '오답 보기가 가리키는 잘못된 규칙',
  '문제별 소요 시간',
]

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Only what the analysis needs (PRD 7.2, 8.3): what the player did per puzzle, and in
 * knownReference the intended rule, the right choice, and the note for the wrong choice that was
 * actually picked. Notes for options the player did not pick are not sent.
 */
export function buildPatternFindPayload(s: SessionCore<PatternFindOutput, Measured>): AiActivityPayload {
  const rows = normalizePuzzles(s.output)

  const puzzles = rows.map((r, i) => {
    const bank = getPuzzle(r.id)
    return {
      n: i + 1,
      sequence: bank ? sequenceText(bank) : '',
      choices: r.choices.map(tokenText),
      picked: r.picked === null ? null : tokenText(r.choices[r.picked]),
      correct: r.correct,
      sec: round1(r.ms / 1000),
      ...(r.ruleText ? { ruleText: r.ruleText } : {}),
    }
  })

  const reference = rows.flatMap((r, i) => {
    const bank = getPuzzle(r.id)
    if (!bank) return []
    const note = r.picked !== null && !r.correct ? bank.distractorNotes[r.picked] : ''
    return [
      {
        n: i + 1,
        intendedRule: bank.intendedRule,
        correctChoice: tokenText(bank.choices[bank.answerIndex]),
        ...(note ? { pickedChoiceNote: note } : {}),
      },
    ]
  })

  return {
    activityId: 'pattern-find',
    activityName: 'PATTERN FIND',
    category: 'LOGIC',
    kind: 'hybrid',
    difficulty: s.difficulty,
    conditions: s.conditions,
    elapsedSec: s.elapsedSec,
    measured: s.measured,
    userOutput: { puzzles },
    rubric: RUBRIC,
    knownReference: { puzzles: reference },
  }
}
