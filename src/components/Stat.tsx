import type { ReactNode } from 'react'

/** App-computed metric: paper box with a solid border (AI text goes in AiPanel instead). */
export function Stat({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="stat">
      <p className="stat__value">
        {value}
        {unit ? <span className="label"> {unit}</span> : null}
      </p>
      <p className="stat__label label">{label}</p>
    </div>
  )
}
