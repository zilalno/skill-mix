import { dateKey, linePoints, niceMax, shortDate } from '../lib/archive'
import type { GrowthPoint } from '../lib/archive'

// Hand-drawn SVG line charts (PRD 6-E: no chart library). One activity at a time, never summed.

const W = 320
const H = 140
const BOX = { x: 40, y: 12, w: W - 40 - 14, h: H - 12 - 28 }

function Line({
  title,
  unit,
  values,
  dates,
  max,
}: {
  title: string
  unit: string
  values: number[]
  dates: string[]
  max: number
}) {
  const pts = linePoints(values, BOX, max)
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const ticks = [0, max / 2, max]
  const summary = values.map((v, i) => `${dates[i]} ${v}${unit}`).join(', ')
  return (
    <figure className="growth__fig">
      <figcaption className="label">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${summary}`} className="growth__svg">
        {ticks.map((t) => {
          const y = BOX.y + BOX.h - (t / max) * BOX.h
          return (
            <g key={t}>
              <line x1={BOX.x} x2={BOX.x + BOX.w} y1={y} y2={y} className="growth__grid" />
              <text x={BOX.x - 6} y={y + 4} textAnchor="end" className="growth__tick">
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          )
        })}
        <path d={d} className="growth__line" fill="none" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5} className="growth__dot" />
            <text x={p.x} y={BOX.y + BOX.h + 18} textAnchor="middle" className="growth__tick">
              {dates[i]}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  )
}

/** Accuracy and average answer time over time for ONE objective/hybrid activity. */
export function GrowthChart({ points, activityName }: { points: GrowthPoint[]; activityName: string }) {
  if (points.length < 2) {
    return <p className="prose growth__hint">비교하려면 한 번 더 도전하세요</p>
  }
  const dates = points.map((p) => shortDate(dateKey(p.completedAt)))
  return (
    <div className="growth" aria-label={`${activityName} 성장 추이`}>
      <Line title="정확도" unit="%" values={points.map((p) => p.accuracyPct)} dates={dates} max={100} />
      <Line
        title="평균 응답 시간 (초)"
        unit="초"
        values={points.map((p) => p.avgSec)}
        dates={dates}
        max={niceMax(Math.max(...points.map((p) => p.avgSec)))}
      />
    </div>
  )
}
