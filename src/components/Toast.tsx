import { useEffect } from 'react'

/** Transient status line. Keep `onClose` referentially stable (useCallback) or the timer restarts. */
export function Toast({
  message,
  onClose,
  durationMs = 3000,
}: {
  message: string | null
  onClose: () => void
  durationMs?: number
}) {
  useEffect(() => {
    if (!message) return
    const id = window.setTimeout(onClose, durationMs)
    return () => window.clearTimeout(id)
  }, [message, onClose, durationMs])

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message ? <p className="toast">{message}</p> : null}
    </div>
  )
}
