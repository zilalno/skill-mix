import { useMemo, useSyncExternalStore } from 'react'

export type Route =
  | { name: 'landing' }
  | { name: 'discover' }
  | { name: 'activity'; id: string }
  | { name: 'result'; sessionId: string }
  | { name: 'archive' }
  | { name: 'not-found' }

/** Pure: '#/activity/word-weave' -> { name: 'activity', id: 'word-weave' }. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0].replace(/\/+$/, '') || '/'
  const parts = path.split('/').filter(Boolean)
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s)
    } catch {
      return s
    }
  }

  if (parts.length === 0) return { name: 'landing' }
  if (parts.length === 1 && parts[0] === 'discover') return { name: 'discover' }
  if (parts.length === 1 && parts[0] === 'archive') return { name: 'archive' }
  if (parts.length === 2 && parts[0] === 'activity') return { name: 'activity', id: decode(parts[1]) }
  if (parts.length === 2 && parts[0] === 'result') return { name: 'result', sessionId: decode(parts[1]) }
  return { name: 'not-found' }
}

/** Path builders so screens never hand-write route strings. */
export const paths = {
  landing: () => '/',
  discover: () => '/discover',
  activity: (id: string) => `/activity/${encodeURIComponent(id)}`,
  result: (sessionId: string) => `/result/${encodeURIComponent(sessionId)}`,
  archive: () => '/archive',
}

export function navigate(path: string): void {
  window.location.hash = path.startsWith('#') ? path : `#${path}`
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const getHash = () => window.location.hash
const getServerHash = () => ''

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash)
  return useMemo(() => parseRoute(hash), [hash])
}
