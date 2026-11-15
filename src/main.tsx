import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './styles/components.css'
import './styles/screens.css'
import './styles/activities.css'
import './styles/result.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Mobile keyboard: where the browser does not resize the layout viewport (iOS Safari), expose how
// much of it the keyboard covers so the sticky submit bar can stay above it.
const vv = window.visualViewport
if (vv) {
  const sync = () => {
    const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    document.documentElement.style.setProperty('--kb-inset', `${Math.round(inset)}px`)
  }
  vv.addEventListener('resize', sync)
  vv.addEventListener('scroll', sync)
}
