import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

// Single registration point. Every GSAP effect in the app goes through useGSAP (auto cleanup)
// and gsap.matchMedia (reduced motion / touch gating), see PRD 10.4.
gsap.registerPlugin(useGSAP, ScrollTrigger)

export { gsap, ScrollTrigger, useGSAP }

/** Media conditions used with gsap.matchMedia(). */
export const MQ = {
  /** Full motion. */
  full: '(prefers-reduced-motion: no-preference)',
  /** Reduced motion: fades or instant display only, no travel and no scroll-linked effects. */
  reduced: '(prefers-reduced-motion: reduce)',
  /** Cursor-driven effects: desktop pointers only (never touch), and never with reduced motion. */
  mouse: '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)',
} as const

export const EASE = 'expo.out'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(MQ.reduced).matches
}

/** Format a count-up frame with the same decimals as the final value. */
export function formatCount(value: number, decimals: number): string {
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))
}

/**
 * Count the numbers inside `[data-count]` elements up from 0 (PRD 10.4: AI result metrics).
 * The element's original text is restored at the end, so the final value is always exactly
 * what React rendered. Returns a cleanup that restores the text: return it from the matchMedia
 * branch so a revert never leaves a half-counted number. Full-motion branch only.
 */
export function countUp(scope: ParentNode, duration = 1): () => void {
  const restore: Array<() => void> = []
  const nodes = Array.from(scope.querySelectorAll<HTMLElement>('[data-count]'))
  for (const el of nodes) {
    const target = Number(el.dataset.count)
    if (!Number.isFinite(target)) continue
    const decimals = Number(el.dataset.decimals ?? 0)
    const finalText = el.textContent ?? ''
    restore.push(() => {
      el.textContent = finalText
    })
    const state = { v: 0 }
    el.textContent = formatCount(0, decimals)
    gsap.to(state, {
      v: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = formatCount(state.v, decimals)
      },
      onComplete: () => {
        el.textContent = finalText
      },
    })
  }
  return () => restore.forEach((fn) => fn())
}
