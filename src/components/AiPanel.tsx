import { Eye } from 'lucide-react'
import type { ReactNode } from 'react'

/** Ink-inverted region reserved for AI-written text (PRD 10.1). */
export function AiPanel({ title = 'AI 관찰', children }: { title?: string; children: ReactNode }) {
  return (
    <section className="ai-panel on-ink" aria-label={title}>
      <div className="ai-panel__head">
        <Eye aria-hidden="true" size={20} />
        <h2 className="label">{title}</h2>
      </div>
      {children}
      <p className="ai-panel__note">AI 분석을 위해 결과물이 외부 서비스로 전송됩니다.</p>
    </section>
  )
}
