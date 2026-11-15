import { Archive, LayoutGrid } from 'lucide-react'
import { paths, useRoute } from '../router'

/** Global header (desktop) + two-tab bar (mobile). Not rendered on Landing or inside an activity. */
export function Header() {
  const { name } = useRoute()
  const current = (route: string) => (name === route ? 'page' : undefined)

  return (
    <>
      <header className="site-header">
        <div className="page site-header__in">
          <a className="logo" href={`#${paths.landing()}`} aria-label="SKILL//MIX 처음으로">
            SKILL//MIX
          </a>
          <nav className="site-nav" aria-label="주요 메뉴">
            <a href={`#${paths.discover()}`} aria-current={current('discover')}>
              DISCOVER
            </a>
            <a href={`#${paths.archive()}`} aria-current={current('archive')}>
              ARCHIVE
            </a>
          </nav>
        </div>
      </header>
      <nav className="tabbar" aria-label="하단 메뉴">
        <a href={`#${paths.discover()}`} aria-current={current('discover')}>
          <LayoutGrid aria-hidden="true" size={20} />
          DISCOVER
        </a>
        <a href={`#${paths.archive()}`} aria-current={current('archive')}>
          <Archive aria-hidden="true" size={20} />
          ARCHIVE
        </a>
      </nav>
    </>
  )
}
