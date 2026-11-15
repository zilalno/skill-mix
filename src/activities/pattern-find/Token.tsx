import { BLANK, parseShape, tokenText } from './data'

/** One puzzle item: the missing slot, a drawn shape (optionally rotated), or plain text. */
export function Token({ value }: { value: string }) {
  if (value === BLANK) {
    return (
      <span className="tok tok--blank" role="img" aria-label={tokenText(value)}>
        ?
      </span>
    )
  }

  const shape = parseShape(value)
  if (!shape) return <span className="tok tok--text">{value}</span>

  return (
    <svg
      className="tok tok--shape"
      viewBox="0 0 100 100"
      role="img"
      aria-label={tokenText(value)}
      style={{ transform: `rotate(${shape.deg}deg)` }}
    >
      {shape.shape === 'circle' && <circle cx="50" cy="50" r="34" fill="currentColor" />}
      {shape.shape === 'ring' && <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="9" />}
      {shape.shape === 'square' && <rect x="18" y="18" width="64" height="64" fill="currentColor" />}
      {shape.shape === 'box' && (
        <rect x="22" y="22" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="9" />
      )}
      {shape.shape === 'tri' && <polygon points="50,14 88,84 12,84" fill="currentColor" />}
      {shape.shape === 'trio' && (
        <polygon points="50,18 84,80 16,80" fill="none" stroke="currentColor" strokeWidth="9" strokeLinejoin="round" />
      )}
    </svg>
  )
}
