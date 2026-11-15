import { useRef, useState } from 'react'
import { Check, Circle } from 'lucide-react'
import type { StageProps } from '../../types'
import { mulberry32, newSeed } from '../random'
import { useStageOutput } from '../stageBridge'
import { SIZE, challengeConstraints, checkAll, emptyGrid, nextShape, pickChallenge, shapesOf } from './challenges'
import type { Cell, CellColor, Shape, ShapeMixOutput } from './challenges'

const SHAPE_NAME: Record<Shape, string> = { '.': '빈칸', O: '동그라미', '□': '네모', '△': '세모' }
const COLOR_NAME: Record<CellColor, string> = { A: '코발트', B: '플레어' }

function ShapeMark({ shape }: { shape: Exclude<Shape, '.'> }) {
  return (
    <svg className="sm__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {shape === 'O' && <circle cx="12" cy="12" r="8.5" />}
      {shape === '□' && <rect x="3.5" y="3.5" width="17" height="17" />}
      {shape === '△' && <polygon points="12,3 21.5,20.5 2.5,20.5" />}
    </svg>
  )
}

/** SHAPE MIX: a 4x4 board. Tap a square to cycle empty -> circle -> square -> triangle -> empty. */
export function ShapeMixStage({ difficulty }: StageProps<ShapeMixOutput>) {
  const [challenge] = useState(() => pickChallenge(difficulty, mulberry32(newSeed())))
  const [grid, setGrid] = useState<Cell[]>(emptyGrid)
  const [color, setColor] = useState<CellColor>('A')
  const [edits, setEdits] = useState(0)

  const gridRef = useRef(grid)
  const editsRef = useRef(0)

  const buildOutput = (): ShapeMixOutput => ({
    challengeId: challenge.id,
    grid: gridRef.current,
    constraints: checkAll(challenge, shapesOf(gridRef.current)),
    edits: editsRef.current,
  })
  useStageOutput(buildOutput)

  const tap = (index: number) => {
    const shape = nextShape(gridRef.current[index].shape)
    const next = gridRef.current.map((c, i) => (i === index ? { shape, color: shape === '.' ? 'A' : color } : c)) as Cell[]
    gridRef.current = next
    editsRef.current += 1
    setGrid(next)
    setEdits(editsRef.current)
  }

  const results = checkAll(challenge, shapesOf(grid))
  const metCount = results.filter((r) => r.met).length
  const labels = challengeConstraints(challenge).map((c) => c.label)

  return (
    <div className="sm" data-color={color}>
      <section aria-labelledby="sm-conditions">
        <p id="sm-conditions" className="label-ko">
          조건 {metCount}/{results.length} 충족
        </p>
        <ul className="sm__conditions">
          {results.map((r, i) => (
            <li key={r.id} className={r.met ? 'sm__cond sm__cond--met' : 'sm__cond'}>
              <span className="sm__cond-mark" aria-hidden="true">
                {r.met ? <Check size={16} strokeWidth={3} /> : <Circle size={16} strokeWidth={2.5} />}
              </span>
              {labels[i]}
              <span className="sr-only">{r.met ? ' (충족)' : ' (미충족)'}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="sm__board" role="group" aria-label="4×4 도형 판">
        {grid.map((cell, i) => {
          const r = Math.floor(i / SIZE) + 1
          const c = (i % SIZE) + 1
          return (
            <button
              key={i}
              type="button"
              className={cell.shape === '.' ? 'sm__cell' : `sm__cell sm__cell--filled sm__cell--${cell.color}`}
              aria-label={`${r}행 ${c}열, ${SHAPE_NAME[cell.shape]}${cell.shape === '.' ? '' : `, ${COLOR_NAME[cell.color]}`}`}
              onClick={() => tap(i)}
            >
              {cell.shape !== '.' && <ShapeMark shape={cell.shape} />}
            </button>
          )
        })}
      </div>

      <div className="sm__tools">
        <fieldset className="sm__palette">
          <legend className="label-ko">색</legend>
          {(['A', 'B'] as const).map((k) => (
            <label key={k} className="sm__swatch-label">
              <input
                className="sr-only"
                type="radio"
                name="sm-color"
                checked={color === k}
                onChange={() => setColor(k)}
              />
              <span className={`sm__swatch sm__swatch--${k}`} />
              <span className="sr-only">{COLOR_NAME[k]}</span>
            </label>
          ))}
        </fieldset>
        <p className="sm__hint label-ko">칸을 누를 때마다 ○ → □ → △ → 빈칸 · 수정 {edits}번</p>
      </div>
    </div>
  )
}
