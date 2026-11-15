import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

interface Common {
  variant?: 'primary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  /** Lucide icon, rendered after the label. Decorative: the label names the action. */
  icon?: ReactNode
  children: ReactNode
}

const cls = (variant: Common['variant'] = 'primary', size: Common['size'] = 'md', extra?: string) =>
  ['btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, extra].filter(Boolean).join(' ')

export function Button({
  variant,
  size,
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type={type} className={cls(variant, size, className)} {...rest}>
      {children}
      {icon}
    </button>
  )
}

/** Same look as Button, but a real link (hash routes). */
export function LinkButton({
  variant,
  size,
  icon,
  children,
  className,
  ...rest
}: Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & { href: string }) {
  return (
    <a className={cls(variant, size, className)} {...rest}>
      {children}
      {icon}
    </a>
  )
}
