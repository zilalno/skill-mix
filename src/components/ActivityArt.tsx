import type { CSSProperties } from 'react'
import type { ActivityId } from '../types'

// w = width as a multiple of the piece size (bars only)
type Piece = { shape: 'circle' | 'sq' | 'tri' | 'ring' | 'bar'; label?: string; w?: number }

// Small CSS-drawn illustrations, one per activity (PRD 6-B). Outlines use currentColor
// so they follow the card colour and its hover invert. Size is set by --art-size.
const ART: Record<ActivityId, Piece[]> = {
  'quick-think': [
    { shape: 'sq', label: '+' },
    { shape: 'sq', label: '−' },
    { shape: 'sq', label: '×' },
    { shape: 'sq', label: '÷' },
  ],
  'pattern-find': [
    { shape: 'circle' },
    { shape: 'sq' },
    { shape: 'circle' },
    { shape: 'ring', label: '?' },
  ],
  'word-weave': [
    { shape: 'bar', w: 2 },
    { shape: 'bar', w: 1.3 },
    { shape: 'bar', w: 2.7 },
  ],
  'shape-mix': [{ shape: 'circle' }, { shape: 'sq' }, { shape: 'tri' }],
}

export function ActivityArt({ id }: { id: ActivityId }) {
  return (
    <div className="art" aria-hidden="true">
      {ART[id].map((p, i) => (
        <span
          key={i}
          className={`art__p art__p--${p.shape}`}
          style={p.w ? ({ width: `calc(var(--art-size) * ${p.w})` } as CSSProperties) : undefined}
        >
          {p.label}
        </span>
      ))}
    </div>
  )
}
