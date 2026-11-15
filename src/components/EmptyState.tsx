import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        {icon}
      </div>
      <h1 className="display h1">{title}</h1>
      {body ? <p className="prose">{body}</p> : null}
      {action}
    </div>
  )
}
