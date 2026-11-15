import { useRef } from 'react'
import { Compass } from 'lucide-react'
import { LinkButton } from './components/Button'
import { EmptyState } from './components/EmptyState'
import { Header } from './components/Header'
import { StorageNotice } from './components/StorageNotice'
import { MQ, gsap, useGSAP } from './lib/motion'
import { paths, useRoute } from './router'
import { Activity } from './screens/Activity'
import { Archive } from './screens/Archive'
import { Discover } from './screens/Discover'
import { Landing } from './screens/Landing'
import { Result } from './screens/Result'

export default function App() {
  const route = useRoute()
  const curtain = useRef<HTMLDivElement>(null)
  const lastKey = useRef<string | undefined>(undefined)

  // Screen change = horizontal wipe (PRD 10.4, 0.5s). The curtain is closed in a layout effect,
  // i.e. before the new screen paints, then opens to the left. Reduced motion: a plain fade.
  // Activity phases (intro/play) are not routes, so only real navigation triggers it.
  const routeKey =
    route.name === 'activity' ? `activity:${route.id}` : route.name === 'result' ? `result:${route.sessionId}` : route.name
  useGSAP(
    () => {
      window.scrollTo(0, 0)
      const el = curtain.current
      const previous = lastKey.current
      lastKey.current = routeKey
      if (!el || previous === undefined || previous === routeKey) return // first paint, or StrictMode re-run
      const mm = gsap.matchMedia()
      mm.add(MQ.full, () => {
        gsap
          .timeline()
          .set(el, { autoAlpha: 1, scaleX: 1, transformOrigin: '100% 50%' })
          .to(el, { scaleX: 0, duration: 0.5, ease: 'power3.inOut' })
          .set(el, { autoAlpha: 0 })
      })
      mm.add(MQ.reduced, () => {
        gsap.timeline().set(el, { autoAlpha: 1, scaleX: 1 }).to(el, { autoAlpha: 0, duration: 0.2 })
      })
      return () => mm.revert()
    },
    { dependencies: [routeKey] },
  )

  // Landing has its own top bar; an activity has its own frame (header, timer, footer).
  const showHeader = route.name !== 'landing' && route.name !== 'activity'

  let screen
  switch (route.name) {
    case 'landing':
      screen = <Landing />
      break
    case 'discover':
      screen = <Discover />
      break
    case 'activity':
      screen = <Activity id={route.id} />
      break
    case 'result':
      screen = <Result sessionId={route.sessionId} />
      break
    case 'archive':
      screen = <Archive />
      break
    default:
      screen = (
        <main className="page stub">
          <EmptyState
            icon={<Compass size={28} />}
            title="길을 잃었어요"
            body="없는 주소입니다."
            action={<LinkButton href={`#${paths.landing()}`}>처음으로</LinkButton>}
          />
        </main>
      )
  }

  return (
    <div className={showHeader ? 'app app--tabbar' : 'app'}>
      {showHeader ? <Header /> : null}
      {screen}
      <StorageNotice />
      <div className="wipe" ref={curtain} aria-hidden="true" />
    </div>
  )
}
