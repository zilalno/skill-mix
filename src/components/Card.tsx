import { useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion'
import { navigate } from '../router'

interface CardProps {
  /** CSS variable name from the registry, e.g. '--acid'. Sets the card colour via data-accent. */
  accent?: string
  /** With href the card is a link (hover/focus invert + tilt, expand-then-go on click). */
  href?: string
  disabled?: boolean
  className?: string
  children: ReactNode
}

export function Card({ accent, href, disabled, className, children }: CardProps) {
  const cls = ['card', disabled && 'card--disabled', className].filter(Boolean).join(' ')
  const ref = useRef<HTMLAnchorElement>(null)
  const leaving = useRef(false)
  const { contextSafe } = useGSAP({ scope: ref })

  // Selecting a card (PRD 10.4, 0.5s): it grows, its neighbours dim, then we navigate.
  // Modified clicks (new tab etc.) and reduced motion keep the plain link behaviour.
  const onClick = contextSafe((e: MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current
    if (!el || !href || e.defaultPrevented || e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || prefersReducedMotion()) return
    e.preventDefault()
    if (leaving.current) return
    leaving.current = true
    const others = Array.from(el.parentElement?.children ?? []).filter((c) => c !== el)
    gsap.to(others, { opacity: 0.25, duration: 0.3, ease: 'power2.out' })
    gsap.to(el, {
      scale: 1.05,
      rotate: 0,
      y: 0,
      duration: 0.5,
      ease: 'expo.out',
      onComplete: () => navigate(href),
    })
  })

  if (href && !disabled) {
    return (
      <a className={cls} href={href} data-accent={accent} ref={ref} onClick={onClick}>
        {children}
      </a>
    )
  }
  return (
    <div className={cls} data-accent={accent} aria-disabled={disabled || undefined}>
      {children}
    </div>
  )
}
