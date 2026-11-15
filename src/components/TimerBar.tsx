/** value: remaining fraction 0..1. Decorative duplicate of the numeric timer, so it is hidden from AT. */
export function TimerBar({ value, warn = false }: { value: number; warn?: boolean }) {
  const p = Math.min(1, Math.max(0, value))
  return (
    <div className={warn ? 'timer-bar timer-bar--warn' : 'timer-bar'} aria-hidden="true">
      <div className="timer-bar__fill" style={{ '--p': p } as React.CSSProperties} />
    </div>
  )
}
