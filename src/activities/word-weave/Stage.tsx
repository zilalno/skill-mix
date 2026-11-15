import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { StageProps } from '../../types'
import { mulberry32, newSeed } from '../random'
import { useStageOutput } from '../stageBridge'
import { MAX_CHARS, MAX_SENTENCES, countSentences, isWordUsed, pickConstraints, pickWords, checkConstraint } from './data'
import type { WordWeaveOutput } from './data'

/** WORD WEAVE: a writing sheet. Word chips fill in as the words appear in the text. */
export function WordWeaveStage({ difficulty }: StageProps<WordWeaveOutput>) {
  const [setup] = useState(() => {
    const rng = mulberry32(newSeed())
    return { words: pickWords(difficulty, rng), constraints: pickConstraints(difficulty, rng) }
  })
  const [text, setText] = useState('')
  const textRef = useRef(text)

  useStageOutput(() => ({ words: setup.words, text: textRef.current, constraints: setup.constraints }))

  const onChange = (value: string) => {
    textRef.current = value
    setText(value)
  }

  const sentences = countSentences(text)
  const usedCount = setup.words.filter((w) => isWordUsed(text, w)).length

  return (
    <div className="ww">
      <section aria-labelledby="ww-words">
        <p id="ww-words" className="label-ko">
          이 단어를 모두 써 보세요 · {usedCount}/{setup.words.length}
        </p>
        <ul className="ww__chips">
          {setup.words.map((w) => {
            const used = isWordUsed(text, w)
            return (
              <li key={w} className={used ? 'ww__chip ww__chip--used' : 'ww__chip'}>
                {used && <Check aria-hidden="true" size={18} strokeWidth={3} />}
                {w}
                <span className="sr-only">{used ? ' (사용함)' : ' (아직 안 씀)'}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {setup.constraints.length > 0 && (
        <ul className="ww__extra" aria-label="추가 조건">
          {setup.constraints.map((c) => (
            <li key={c.id} className={checkConstraint(c.id, text) ? 'ww__extra-item ww__extra-item--met' : 'ww__extra-item'}>
              <span className="label">추가 조건</span> {c.label}
              {checkConstraint(c.id, text) && <span className="sr-only"> (충족)</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="ww__sheet">
        <label htmlFor="ww-text" className="label-ko">
          1~{MAX_SENTENCES}문장으로 써 보세요
        </label>
        <textarea
          id="ww-text"
          className="ww__text"
          rows={6}
          maxLength={MAX_CHARS}
          autoComplete="off"
          spellCheck={false}
          placeholder="단어들이 서로 이어지게 문장을 만들어 보세요."
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
        <p className="ww__hint">
          <span>개인정보는 쓰지 마세요.</span>
          <span className="ww__counter" aria-live="off">
            {sentences}문장 · {text.length}/{MAX_CHARS}
          </span>
        </p>
      </div>
    </div>
  )
}
