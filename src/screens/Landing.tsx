import { useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { KIND_LABEL } from '../activities/labels'
import { ACTIVITIES } from '../activities/registry'
import { LinkButton } from '../components/Button'
import { Card } from '../components/Card'
import { Chip } from '../components/Chip'
import { EASE, MQ, ScrollTrigger, gsap, useGSAP } from '../lib/motion'
import { paths } from '../router'

const HERO_LINES = ['MIX', 'YOUR', 'SKILLS.']

const STEPS = [
  { n: '01', title: 'DISCOVER', body: '짧은 활동 네 가지 중 하나를 고릅니다.' },
  { n: '02', title: 'CREATE / SOLVE', body: '1~3분 안에 문제를 풀거나 직접 만들어 냅니다.' },
  { n: '03', title: 'FEEDBACK', body: '내가 낸 결과물의 관찰 가능한 특징을 AI가 짚어 줍니다.' },
  { n: '04', title: 'ARCHIVE', body: '결과물과 기록은 이 브라우저에만 쌓입니다.' },
]

export function Landing() {
  const root = useRef<HTMLDivElement>(null)

  // PRD 10.4 motion for this screen. All of it lives in one matchMedia so useGSAP reverts it:
  //  - full: hero letters slide up (0.9s), the four steps and the activity cards enter on scroll
  //  - reduced: a short fade only, no travel, no scroll linkage
  //  - mouse (desktop pointer, not reduced): hero tags follow the cursor via quickTo
  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add(MQ.full, () => {
        gsap.fromTo('.hero__char', { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: EASE, stagger: 0.04, clearProps: 'transform' })
        gsap.fromTo('.hero__tags .tag', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.08, delay: 0.5, clearProps: 'opacity,scale' })
        gsap.fromTo('.hero__foot', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: EASE, delay: 0.6, clearProps: 'opacity,transform' })

        // Fonts change line heights after first paint; re-measure the scroll positions once they load.
        void document.fonts?.ready.then(() => ScrollTrigger.refresh())

        const enter = (targets: string, trigger: string, stagger: number) =>
          // fromTo (explicit end values): a plain from() reads its end state from the DOM, which is
          // wrong if a previous StrictMode run left inline styles behind.
          gsap.fromTo(targets, { opacity: 0, y: 56 }, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: EASE,
            stagger,
            clearProps: 'opacity,transform', // hand control back to CSS (card hover tilt)
            scrollTrigger: { trigger, start: 'top 85%', once: true },
          })
        enter('.steps__title', '.steps__title', 0)
        enter('.step', '.steps__grid', 0.14)
        enter('.preview__title', '.preview__title', 0)
        enter('.preview__card', '.preview__row', 0.1)
      })

      mm.add(MQ.reduced, () => {
        gsap.fromTo('.hero__title, .hero__tags, .hero__foot', { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'opacity' })
      })

      mm.add(MQ.mouse, () => {
        const movers = gsap.utils.toArray<HTMLElement>('.hero__tags .tag').map((el, i) => ({
          x: gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power3.out' }),
          y: gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3.out' }),
          depth: 18 + i * 14,
        }))
        const onMove = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return
          const nx = e.clientX / window.innerWidth - 0.5
          const ny = e.clientY / window.innerHeight - 0.5
          for (const m of movers) {
            m.x(nx * m.depth * 2)
            m.y(ny * m.depth * 2)
          }
        }
        window.addEventListener('pointermove', onMove)
        return () => window.removeEventListener('pointermove', onMove)
      })

      // Explicit revert: StrictMode re-runs this effect, and ScrollTrigger from-tweens must be undone
      // fully (inline styles included) before the second run measures them.
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <div className="landing" ref={root}>
      <header className="page landing-top">
        <a className="logo" href={`#${paths.landing()}`} aria-label="SKILL//MIX 처음으로">
          SKILL//MIX
        </a>
        <nav className="landing-top__nav" aria-label="주요 메뉴">
          <a className="landing-top__link label" href={`#${paths.archive()}`}>
            ARCHIVE
          </a>
          <LinkButton size="sm" href={`#${paths.discover()}`}>
            ENTER
          </LinkButton>
        </nav>
      </header>

      <main>
        <section className="page hero">
          <div className="hero__body">
            <h1 className="hero__title display" aria-label="MIX YOUR SKILLS.">
              {HERO_LINES.map((line) => (
                <span className="hero__line" key={line} aria-hidden="true">
                  {Array.from(line).map((ch, i) => (
                    <span className="hero__char" key={i}>
                      {ch}
                    </span>
                  ))}
                </span>
              ))}
            </h1>
            <ul className="hero__tags" aria-hidden="true">
              {ACTIVITIES.map((a) => (
                <li className="tag" key={a.id} data-accent={a.accent}>
                  {a.name.split(' ')[0]}
                </li>
              ))}
            </ul>
          </div>
          <div className="hero__foot">
            <p className="hero__tagline">짧은 활동 · 내 결과물 · AI 피드백</p>
            <LinkButton size="lg" href={`#${paths.discover()}`} icon={<ArrowRight aria-hidden="true" size={24} />}>
              ENTER THE MIX
            </LinkButton>
          </div>
        </section>

        <section className="page section" aria-labelledby="steps-title">
          <h2 id="steps-title" className="display h1 steps__title">
            4 STEPS
          </h2>
          <ol className="steps__grid">
            {STEPS.map((s) => (
              <li className="step" key={s.n}>
                <p className="step__num display" aria-label={`${s.n}단계`}>
                  {s.n}
                </p>
                <h3 className="h2">{s.title}</h3>
                <p className="step__body">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section preview" aria-labelledby="preview-title">
          <div className="page">
            <h2 id="preview-title" className="display h1 preview__title">
              {ACTIVITIES.length} ACTIVITIES
            </h2>
          </div>
          <div className="preview__row">
            {ACTIVITIES.map((a) => (
              <Card key={a.id} accent={a.accent} href={`#${paths.activity(a.id)}`} className="preview__card">
                <h3 className="display preview__name">{a.name}</h3>
                <p>{a.tagline}</p>
                <div className="chips">
                  <Chip>{a.category}</Chip>
                  <Chip>{KIND_LABEL[a.kind]}</Chip>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="page disclaimer">
        <p>실제 능력 향상을 주장하지 않으며, 활동 결과의 관찰 가능한 특징만 다룹니다.</p>
      </footer>
    </div>
  )
}
