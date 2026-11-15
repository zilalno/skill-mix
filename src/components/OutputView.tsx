import { Check, Minus, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { normalizePuzzles } from '../activities/pattern-find/evaluate'
import { normalizeProblems } from '../activities/quick-think/evaluate'
import { OP_LABEL } from '../activities/quick-think/data'
import { normalizeOutput as normalizeShapeMix } from '../activities/shape-mix/evaluate'
import { normalizeOutput as normalizeWordWeave, matchWords } from '../activities/word-weave/evaluate'
import type { SessionRecord } from '../types'
import { Stat } from './Stat'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const sec = (ms: number) => `${(Math.round(ms / 100) / 10).toFixed(1)}초`

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="mark mark--ok">
      <Check size={16} aria-hidden="true" />
      <span className="sr-only">맞음</span>
    </span>
  ) : (
    <span className="mark mark--no">
      <X size={16} aria-hidden="true" />
      <span className="sr-only">틀림</span>
    </span>
  )
}

function QuickThinkOutput({ output }: { output: unknown }) {
  const problems = normalizeProblems(output)
  if (problems.length === 0) return <p className="prose out__empty">푼 문제가 없습니다.</p>
  return (
    <div className="out__scroll">
      <table className="out-table">
        <caption className="sr-only">제출한 문제 목록</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">문제</th>
            <th scope="col">내 답</th>
            <th scope="col">정답</th>
            <th scope="col">시간</th>
          </tr>
        </thead>
        <tbody>
          {problems.map((p, i) => (
            <tr key={i} className={p.correct ? undefined : 'is-wrong'}>
              <td>{i + 1}</td>
              <td>
                <span className="out-table__expr">{p.expr}</span>
                <span className="label-ko out-table__op"> {OP_LABEL[p.op]}</span>
              </td>
              <td>
                <Mark ok={p.correct} /> {p.userAnswer}
              </td>
              <td>{p.answer}</td>
              <td>{sec(p.ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PatternFindOutput({ output }: { output: unknown }) {
  const puzzles = normalizePuzzles(output)
  if (puzzles.length === 0) return <p className="prose out__empty">푼 문제가 없습니다.</p>
  return (
    <ol className="out-puzzles">
      {puzzles.map((p, i) => (
        <li key={`${p.id}-${i}`} className="out-puzzle">
          <div className="out-puzzle__head">
            <span className="label">문제 {i + 1}</span>
            {p.picked === null ? (
              <span className="mark mark--skip">
                <Minus size={16} aria-hidden="true" /> 건너뜀
              </span>
            ) : (
              <Mark ok={p.correct} />
            )}
            <span className="label">{sec(p.ms)}</span>
          </div>
          <p>{p.prompt}</p>
          <ul className="chips out-puzzle__choices" aria-label="보기">
            {p.choices.map((c, ci) => (
              <li key={ci} className={ci === p.picked ? 'chip chip--ink' : 'chip'}>
                {c}
                {ci === p.picked ? <span className="sr-only"> (내가 고른 답)</span> : null}
              </li>
            ))}
          </ul>
          {p.ruleText && p.ruleText.trim() !== '' ? (
            <blockquote className="out-quote">
              <span className="label">내가 쓴 규칙</span>
              {p.ruleText}
            </blockquote>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function WordWeaveOutput({ output }: { output: unknown }) {
  const { words, text, constraints } = normalizeWordWeave(output)
  const { used, missing } = matchWords(text, words)
  return (
    <div className="out-words">
      {words.length > 0 ? (
        <ul className="chips" aria-label="제시된 단어">
          {words.map((w) => (
            <li key={w} className={used.includes(w) ? 'chip chip--ink' : 'chip chip--miss'}>
              {w}
              <span className="sr-only">{used.includes(w) ? ' (사용함)' : ' (빠짐)'}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {text.trim() === '' ? <p className="prose out__empty">작성한 글이 없습니다.</p> : <p className="out-text">{text}</p>}
      {missing.length > 0 ? <p className="label-ko out__note">빠진 단어: {missing.join(', ')}</p> : null}
      {constraints.length > 0 ? (
        <ul className="out-constraints" aria-label="추가 조건">
          {constraints.map((c) => (
            <li key={c.id} className="label-ko">
              {c.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ShapeMixOutput({ output }: { output: unknown }) {
  const { grid, constraints } = normalizeShapeMix(output)
  const names: Record<string, string> = { '.': '빈 칸', O: '원', '□': '사각형', '△': '삼각형' }
  return (
    <div className="out-shape">
      <div className="out-grid" role="img" aria-label={`4×4 그리드, 도형 ${grid.filter((c) => c.shape !== '.').length}개`}>
        {grid.map((c, i) => (
          <span
            key={i}
            className={['out-grid__cell', c.shape !== '.' && 'is-filled', c.color === 'B' && 'is-b'].filter(Boolean).join(' ')}
            title={`${names[c.shape] ?? ''}${c.shape !== '.' ? (c.color === 'B' ? ' (B색)' : ' (A색)') : ''}`}
          >
            {c.shape === '.' ? '' : c.shape}
          </span>
        ))}
      </div>
      {constraints.length > 0 ? (
        <ul className="out-constraints" aria-label="조건 충족 여부">
          {constraints.map((c) => (
            <li key={c.id} className="label-ko">
              <Mark ok={c.met} /> {c.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** The submission exactly as it was stored, drawn per activity (PRD 6-D ①). */
export function OutputView({ session }: { session: Pick<SessionRecord, 'activityId' | 'output'> }): ReactNode {
  switch (session.activityId) {
    case 'quick-think':
      return <QuickThinkOutput output={session.output} />
    case 'pattern-find':
      return <PatternFindOutput output={session.output} />
    case 'word-weave':
      return <WordWeaveOutput output={session.output} />
    case 'shape-mix':
      return <ShapeMixOutput output={session.output} />
    default:
      return <p className="prose out__empty">이 결과물은 표시할 수 없습니다.</p>
  }
}

function formatValue(v: unknown): string {
  if (typeof v === 'boolean') return v ? '충족' : '미충족'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v === '' ? '—' : v
  return '—'
}

/** App-computed numbers (PRD 6-D ②): one Stat per label the activity declared. */
/** Numbers carry data-count so the result screen can count them up (see lib/motion countUp). */
function statValue(v: unknown) {
  const text = formatValue(v)
  if (typeof v !== 'number' || !Number.isFinite(v) || /e/i.test(text)) return text
  const decimals = Math.min(3, text.split('.')[1]?.length ?? 0)
  return (
    <span data-count={v} data-decimals={decimals}>
      {text}
    </span>
  )
}

export function MeasuredStats({ session }: { session: Pick<SessionRecord, 'measured' | 'labels'> }) {
  const m = isObject(session.measured) ? session.measured : {}
  const items = session.labels.filter((l) => String(l.key) in m)
  if (items.length === 0) return null
  return (
    <div className="measured__grid">
      {items.map((l) => (
        <Stat key={String(l.key)} label={l.label} value={statValue(m[String(l.key)])} unit={l.unit} />
      ))}
    </div>
  )
}
