import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { AnyActivity } from '../activities/registry'
import { DIFFICULTY_LABEL, KIND_LABEL } from '../activities/labels'
import { StageBridge, type OutputGetter } from '../activities/stageBridge'
import type { FinishMeta } from '../activities/useActivityRun'
import { MQ, gsap, prefersReducedMotion, useGSAP } from '../lib/motion'
import { navigate, paths } from '../router'
import type { Difficulty } from '../types'
import { ActivityArt } from './ActivityArt'
import { Button } from './Button'
import { Chip } from './Chip'
import { ConfirmModal } from './ConfirmModal'
import { Stat } from './Stat'
import { TimerBar } from './TimerBar'

type Phase = 'intro' | 'countdown' | 'play' | 'finished'

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']
const COUNTDOWN_FROM = 3
const WARN_MS = 10_000
/** Length of the closing "frame shrinks" beat before the run is saved and we navigate (PRD 10.4: 0.6s). */
const FINISH_MS = 600

/** 3-2-1: each number punches in (0.6s). Reduced motion: a plain fade. */
function Countdown({ count, accent }: { count: number; accent: string }) {
  const n = useRef<HTMLParagraphElement>(null)
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MQ.full, () => {
        gsap.fromTo(n.current, { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' })
      })
      mm.add(MQ.reduced, () => {
        gsap.fromTo(n.current, { opacity: 0 }, { opacity: 1, duration: 0.2 })
      })
    },
    { dependencies: [count], scope: n },
  )
  return (
    <div className="countdown" data-accent={accent} role="status" aria-label="곧 시작합니다">
      <p className="countdown__n display" ref={n}>
        {count}
      </p>
    </div>
  )
}

/** End of a run: the accent frame contracts around "제출 완료" before the result screen opens. */
function FinishedFrame({ accent }: { accent: string }) {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MQ.full, () => {
        gsap.fromTo(
          '.finished-frame__box',
          { clipPath: 'inset(0% 0% 0% 0%)' },
          { clipPath: 'inset(30% 10% 30% 10%)', duration: FINISH_MS / 1000, ease: 'power3.inOut' },
        )
        gsap.from('.finished-frame__text', { opacity: 0, duration: 0.3, delay: 0.25 })
      })
    },
    { scope: root },
  )
  return (
    <div className="finished-frame" data-accent={accent} ref={root} role="status">
      <div className="finished-frame__box" />
      <p className="finished-frame__text display">제출 완료</p>
    </div>
  )
}

const formatTime = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  activity: AnyActivity
  /** Called exactly once per run. What happens next (save, navigate) belongs to useActivityRun. */
  onFinish: (output: unknown, meta: FinishMeta) => void
}

export function ActivityShell({ activity, onFinish }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [count, setCount] = useState(COUNTDOWN_FROM)
  const [remainingMs, setRemainingMs] = useState(0)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const limitMs = activity.timeLimitSec(difficulty) * 1000
  const startedAt = useRef(0)
  const submitted = useRef(false)
  const outputGetter = useRef<OutputGetter | null>(null)
  const latest = useRef({ onFinish, difficulty, limitMs })
  useEffect(() => {
    latest.current = { onFinish, difficulty, limitMs }
  })

  const bridge = useMemo(
    () => ({
      register: (getter: OutputGetter | null) => {
        outputGetter.current = getter
      },
    }),
    [],
  )

  // Single exit for every kind of submission; the ref makes double clicks and
  // "Stage submits + timer hits 0" races harmless.
  const finish = useCallback((output: unknown, timedOut: boolean, elapsedMs?: number) => {
    if (submitted.current) return
    submitted.current = true
    const { onFinish: cb, difficulty: d, limitMs: limit } = latest.current
    setPhase('finished')
    const meta = {
      elapsedMs: elapsedMs ?? Math.min(performance.now() - startedAt.current, limit),
      timedOut,
      difficulty: d,
    }
    // The output is already captured above; only the save + navigation waits for the closing beat.
    if (prefersReducedMotion()) cb(output, meta)
    else window.setTimeout(() => cb(output, meta), FINISH_MS)
  }, [])

  const submitCurrent = useCallback(
    (timedOut: boolean) => finish(outputGetter.current ? outputGetter.current() : null, timedOut),
    [finish],
  )

  useEffect(() => {
    if (phase !== 'countdown') return
    let n = COUNTDOWN_FROM
    const id = window.setInterval(() => {
      n -= 1
      if (n <= 0) {
        window.clearInterval(id)
        setPhase('play')
      } else {
        setCount(n)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase])

  // Timer is derived from performance.now(), not from counting ticks, so a throttled
  // background tab cannot make it drift.
  useEffect(() => {
    if (phase !== 'play') return
    startedAt.current = performance.now()
    const tick = () => {
      const left = Math.max(0, latest.current.limitMs - (performance.now() - startedAt.current))
      setRemainingMs(left)
      if (left <= 0) {
        window.clearInterval(id)
        submitCurrent(true)
      }
    }
    const id = window.setInterval(tick, 100)
    tick()
    return () => window.clearInterval(id)
  }, [phase, submitCurrent])

  const start = () => {
    submitted.current = false
    setCount(COUNTDOWN_FROM)
    setRemainingMs(limitMs)
    setPhase('countdown')
  }

  const Stage = activity.Stage
  const warn = remainingMs <= WARN_MS
  const diffLabel = DIFFICULTY_LABEL[difficulty]

  if (phase === 'finished') return <FinishedFrame accent={activity.accent} />

  if (phase === 'intro') {
    return (
      <div className="shell" data-accent={activity.accent}>
        <div className="page">
          <a className="back" href={`#${paths.discover()}`}>
            <ArrowLeft aria-hidden="true" size={18} />
            DISCOVER
          </a>
        </div>
        <main className="page intro">
          <section className="intro__title">
            <div>
              <h1 className="display intro__name">{activity.name}</h1>
              <p className="intro__tagline">{activity.tagline}</p>
            </div>
            <ActivityArt id={activity.id} />
            <div className="chips">
              <Chip>{activity.category}</Chip>
              <Chip>{KIND_LABEL[activity.kind as keyof typeof KIND_LABEL]}</Chip>
              <Chip>≈ {activity.estMinutes} MIN</Chip>
            </div>
          </section>

          <section className="intro__panel" aria-label="시작 전 안내">
            <div>
              <h2 className="h2">규칙</h2>
              <ul className="rules">
                {activity.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>

            <fieldset className="diff">
              <legend className="label-ko">난이도</legend>
              <div className="seg">
                {DIFFICULTIES.map((d) => (
                  <label key={d}>
                    <input
                      className="sr-only"
                      type="radio"
                      name="difficulty"
                      value={d}
                      checked={difficulty === d}
                      onChange={() => setDifficulty(d)}
                    />
                    <span>{DIFFICULTY_LABEL[d]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Stat label="TIME LIMIT" value={activity.timeLimitSec(difficulty)} unit="SEC" />

            <Button size="lg" icon={<ArrowRight aria-hidden="true" size={24} />} onClick={start}>
              START
            </Button>
          </section>
        </main>
      </div>
    )
  }

  if (phase === 'countdown') return <Countdown count={count} accent={activity.accent} />

  return (
    <div className="shell" data-accent={activity.accent}>
      <header className="page play-head">
        <Button variant="ghost" size="sm" icon={<ArrowLeft aria-hidden="true" size={18} />} onClick={() => setLeaveOpen(true)}>
          DISCOVER
        </Button>
        <div className="play-head__title">
          <h1 className="play-title">{activity.name}</h1>
          <p className="label">
            {activity.category} · {diffLabel}
          </p>
        </div>
        <p className={warn ? 'timer timer--warn' : 'timer'} role="timer" aria-label="남은 시간">
          {formatTime(remainingMs)}
        </p>
      </header>

      <div className="page play-meta">
        <p className="play-conditions">{activity.rules.join(' · ')}</p>
        <TimerBar value={remainingMs / limitMs} warn={warn} />
        <p className="sr-only" role="status">
          {warn ? '남은 시간 10초 이하' : ''}
        </p>
      </div>

      <main className="page play-main">
        <div className="play-stage">
          <StageBridge.Provider value={bridge}>
            <Stage
              difficulty={difficulty}
              remainingMs={remainingMs}
              onSubmit={(output, meta) => finish(output, meta.timedOut, meta.elapsedMs)}
            />
          </StageBridge.Provider>
        </div>
      </main>

      <footer className="play-foot">
        <div className="page play-foot__in">
          <Button variant="ghost" onClick={() => submitCurrent(false)}>
            포기하고 결과 보기
          </Button>
          <Button icon={<ArrowRight aria-hidden="true" size={20} />} onClick={() => submitCurrent(false)}>
            제출
          </Button>
        </div>
      </footer>

      <ConfirmModal
        open={leaveOpen}
        title="활동을 떠날까요?"
        body="지금 나가면 이번 시도는 저장되지 않습니다."
        confirmLabel="나가기"
        cancelLabel="계속하기"
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => navigate(paths.discover())}
      />
    </div>
  )
}
