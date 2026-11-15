import { paths, useRoute } from './router'
import { Activity } from './screens/Activity'
import { Archive } from './screens/Archive'
import { Discover } from './screens/Discover'
import { Landing } from './screens/Landing'
import { Result } from './screens/Result'

// Temporary scaffold links so every route is reachable; replaced by the real header/nav later.
const SCAFFOLD_LINKS = [
  ['LANDING', paths.landing()],
  ['DISCOVER', paths.discover()],
  ['ACTIVITY', paths.activity('word-weave')],
  ['RESULT', paths.result('demo')],
  ['ARCHIVE', paths.archive()],
] as const

export default function App() {
  const route = useRoute()

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
      screen = <h1>NOT FOUND</h1>
  }

  return (
    <>
      <nav>
        {SCAFFOLD_LINKS.map(([label, path]) => (
          <a key={label} href={`#${path}`} style={{ marginRight: 12 }}>
            {label}
          </a>
        ))}
      </nav>
      {screen}
    </>
  )
}
