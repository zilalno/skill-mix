import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, CornerDownLeft, Delete, X } from 'lucide-react'
import type { PointerEvent } from 'react'
import type { StageProps } from '../../types'
import { newSeed } from '../random'
import { useStageOutput } from '../stageBridge'
import { MAX_ANSWER_DIGITS, createProblemGenerator, judgeAnswer, toResult } from './data'
import type { Problem, ProblemResult, QuickThinkOutput } from './data'

const TAPE_LENGTH = 3
const KEY_LAYOUT = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'back', '0', 'enter'] as const

// Keeps focus where it is, so a following physical Enter does not re-press a keypad button.
const keepFocus = (e: PointerEvent) => e.preventDefault()

/** QUICK THINK: a calculator tape. Huge expression, receipt lines of the last answers, number pad. */
export function QuickThinkStage({ difficulty }: StageProps<QuickThinkOutput>) {
  const [stream] = useState(() => {
    const next = createProblemGenerator(newSeed(), difficulty)
    return { next, first: next() }
  })
  const [problem, setProblem] = useState<Problem>(stream.first)
  const [input, setInput] = useState('')
  const [tape, setTape] = useState<ProblemResult[]>([])

  const problemRef = useRef(stream.first)
  const inputRef = useRef('')
  const results = useRef<ProblemResult[]>([])
  const shownAt = useRef(performance.now())

  // The shell reads this when time runs out or its own submit button is pressed.
  useStageOutput(() => ({ problems: [...results.current] }))

  const press = useCallback((digit: string) => {
    const cur = inputRef.current
    if (cur.length >= MAX_ANSWER_DIGITS) return
    inputRef.current = cur === '0' ? digit : cur + digit
    setInput(inputRef.current)
  }, [])

  const backspace = useCallback(() => {
    inputRef.current = inputRef.current.slice(0, -1)
    setInput(inputRef.current)
  }, [])

  // Right or wrong, the next problem follows (PRD 7.1). An empty answer is not submitted.
  const submit = useCallback(() => {
    const judged = judgeAnswer(problemRef.current, inputRef.current)
    if (!judged) return
    const result = toResult(problemRef.current, judged.userAnswer, Math.round(performance.now() - shownAt.current))
    results.current.push(result)
    setTape((prev) => [...prev, result].slice(-TAPE_LENGTH))

    const next = stream.next()
    problemRef.current = next
    setProblem(next)
    inputRef.current = ''
    setInput('')
    shownAt.current = performance.now()
  }, [stream])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // Let buttons, links and fields keep their own keyboard behaviour. The target is not always
      // an element (window/document for synthetic or assistive-tech events), so check before use.
      const t = e.target instanceof Element ? e.target : null
      if (t && (t.closest('button, a, input, textarea, select, dialog') || (t as HTMLElement).isContentEditable)) return
      if (/^[0-9]$/.test(e.key)) {
        press(e.key)
        e.preventDefault()
      } else if (e.key === 'Backspace') {
        backspace()
        e.preventDefault()
      } else if (e.key === 'Enter') {
        if (!e.repeat) submit()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, backspace, submit])

  const last = tape[tape.length - 1]

  return (
    <div className="qt">
      <div className="qt__main">
        <ol className="qt__tape" aria-label="직전 풀이">
          {tape.map((r, i) => (
            <li key={results.current.length - tape.length + i} className={r.correct ? 'qt__line' : 'qt__line qt__line--miss'}>
              {r.correct ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
              <span>
                {r.expr} = {r.userAnswer}
                {r.correct ? '' : ` (정답 ${r.answer})`}
              </span>
            </li>
          ))}
        </ol>

        <p className="qt__expr">
          <span className="sr-only">문제: </span>
          {problem.expr}
        </p>

        <output className="qt__answer" aria-label="내 답">
          <span className="qt__eq" aria-hidden="true">
            =
          </span>
          <span className="qt__digits">{input}</span>
          <span className="qt__cursor" aria-hidden="true" />
        </output>

        <p className="sr-only" role="status">
          {last ? (last.correct ? '정답' : `오답, 정답은 ${last.answer}`) : ''}
        </p>
      </div>

      <div className="qt__keys" role="group" aria-label="숫자 키패드">
        {KEY_LAYOUT.map((key) => {
          if (key === 'back') {
            return (
              <button key={key} type="button" className="qt__key" aria-label="지우기" onPointerDown={keepFocus} onClick={backspace}>
                <Delete size={26} aria-hidden="true" />
              </button>
            )
          }
          if (key === 'enter') {
            return (
              <button
                key={key}
                type="button"
                className="qt__key qt__key--enter"
                aria-label="답 제출"
                disabled={input === ''}
                onPointerDown={keepFocus}
                onClick={submit}
              >
                <CornerDownLeft size={26} aria-hidden="true" />
              </button>
            )
          }
          return (
            <button key={key} type="button" className="qt__key" onPointerDown={keepFocus} onClick={() => press(key)}>
              {key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
