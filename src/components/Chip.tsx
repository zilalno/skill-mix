import type { ReactNode } from 'react'

export function Chip({ children, tone = 'outline' }: { children: ReactNode; tone?: 'outline' | 'ink' }) {
  return <span className={tone === 'ink' ? 'chip chip--ink' : 'chip'}>{children}</span>
}
