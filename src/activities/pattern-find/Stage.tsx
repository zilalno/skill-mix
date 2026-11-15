import { useCallback, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '../../components/Button'
import type { StageProps } from '../../types'
import { mulberry32, newSeed } from '../random'
import { useStageOutput } from '../stageBridge'
import { PUZZLE_COUNT, RULE_MAX_CHARS, buildResults, sequenceText, selectPuzzles } from './data'
import type { PatternFindOutput } from './data'
import { Token } from './Token'

const LETTERS = ['A', 'B', 'C', 'D']

/** PATTERN FIND: a specimen board. A strip of tiles with one gap, four lettered tiles to fill it. */
export function PatternFindStage({ difficulty }: StageProps<PatternFindOutput>) {
  const [puzzles] = useState(() => selectPuzzles(difficulty, mulberry32(newSeed()), PUZZLE_COUNT))
  const [index, setIndex] = useState(0)
  const [picks, setPicks] = useState<(number | null)[]>(() => puzzles.map(() => null))
  const [rules, setRules] = useState<string[]>(() => puzzles.map(() => ''))

  const indexRef = useRef(0)
  const picksRef = useRef(picks)
  const rulesRef = useRef(rules)
  const spentMs = useRef<number[]>(puzzles.map(() => 0))
  const viewStart = useRef(performance.now())

  // Time is counted per puzzle while it is on screen.
  const flush = useCallback(() => {
    const now = performance.now()
    spentMs.current[indexRef.current] += now - viewStart.current
    viewStart.current = now
  }, [])

  useStageOutput(() => {
    flush()
    return { puzzles: buildResults(puzzles, picksRef.current, rulesRef.current, spentMs.current) }
  })

  const goTo = (next: number) => {
    if (next < 0 || next >= puzzles.length || next === indexRef.current) return
    flush()
    indexRef.current = next
    setIndex(next)
  }

  const pick = (choice: number | null) => {
    const next = [...picksRef.current]
    next[indexRef.current] = choice
    picksRef.current = next
    setPicks(next)
  }

  const setRule = (text: string) => {
    const next = [...rulesRef.current]
    next[indexRef.current] = text
    rulesRef.current = next
    setRules(next)
  }

  const puzzle = puzzles[index]
  const picked = picks[index]
  const rule = rules[index]
  const boardStyle = puzzle.columns ? ({ '--cols': puzzle.columns } as CSSProperties) : undefined

  return (
    <div className="pf">
      <div className="pf__top">
        <p className="pf__count label" aria-hidden="true">
          Q{index + 1} / {puzzles.length}
        </p>
        <ol className="pf__steps" aria-label="문제 이동">
          {puzzles.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className={['pf__step', picks[i] !== null && 'pf__step--done'].filter(Boolean).join(' ')}
                aria-current={i === index ? 'step' : undefined}
                aria-label={`${i + 1}번 문제${picks[i] !== null ? ', 선택함' : ''}`}
                onClick={() => goTo(i)}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <p className="pf__prompt">{puzzle.prompt}</p>

      <div
        className={puzzle.columns ? 'pf__board pf__board--table' : 'pf__board'}
        style={boardStyle}
        role="group"
        aria-label={`문제: ${sequenceText(puzzle)}`}
      >
        {puzzle.items.map((item, i) => (
          <span key={i} className={item === '?' ? 'pf__tile pf__tile--blank' : 'pf__tile'}>
            <Token value={item} />
          </span>
        ))}
      </div>

      <fieldset className="pf__choices">
        <legend className="sr-only">보기</legend>
        {puzzle.choices.map((choice, i) => (
          <label className="pf__choice" key={`${puzzle.id}-${i}`}>
            <input
              className="sr-only"
              type="radio"
              name={`pf-${puzzle.id}`}
              checked={picked === i}
              onChange={() => pick(i)}
            />
            <span className="pf__tile pf__tile--choice">
              <span className="pf__letter" aria-hidden="true">
                {LETTERS[i]}
              </span>
              <Token value={choice} />
            </span>
          </label>
        ))}
      </fieldset>

      <div className="pf__rule">
        <label htmlFor={`pf-rule-${puzzle.id}`} className="label-ko">
          발견한 규칙 한 줄 (선택)
        </label>
        <input
          id={`pf-rule-${puzzle.id}`}
          className="pf__input"
          type="text"
          maxLength={RULE_MAX_CHARS}
          autoComplete="off"
          placeholder="예: 앞의 수에 같은 수를 더한다"
          value={rule}
          onChange={(e) => setRule(e.target.value)}
        />
        <p className="pf__hint">
          <span>이름·연락처 같은 개인정보는 적지 마세요.</span>
          <span className="pf__counter" aria-hidden="true">
            {rule.length}/{RULE_MAX_CHARS}
          </span>
        </p>
      </div>

      <div className="pf__nav">
        <Button variant="ghost" size="sm" icon={<ArrowLeft aria-hidden="true" size={18} />} disabled={index === 0} onClick={() => goTo(index - 1)}>
          이전
        </Button>
        {picked !== null ? (
          <Button variant="ghost" size="sm" onClick={() => pick(null)}>
            선택 취소
          </Button>
        ) : (
          <span className="pf__skip label-ko">고르지 않으면 건너뜀으로 기록돼요</span>
        )}
        <Button
          size="sm"
          icon={<ArrowRight aria-hidden="true" size={18} />}
          disabled={index === puzzles.length - 1}
          onClick={() => goTo(index + 1)}
        >
          다음
        </Button>
      </div>
    </div>
  )
}
