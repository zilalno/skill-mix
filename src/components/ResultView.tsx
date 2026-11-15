import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { getActivity } from '../activities/registry'
import { DIFFICULTY_LABEL, KIND_LABEL } from '../activities/labels'
import { retryAnalysis, requestAnalysis } from '../lib/ai'
import { formatDateTime } from '../lib/archive'
import { EASE, MQ, countUp, gsap, useGSAP } from '../lib/motion'
import { getSession } from '../lib/storage'
import { useAiConsent } from '../lib/useAiConsent'
import { paths } from '../router'
import type { AiErrorCode, AiFeedback, SessionRecord } from '../types'
import { AiPanel } from './AiPanel'
import { Button, LinkButton } from './Button'
import { Chip } from './Chip'
import { MeasuredStats, OutputView } from './OutputView'

const PENDING_DISPLAY_MAX_SEC = 30
const POLL_MS = 500

const ERROR_TEXT: Record<AiErrorCode, string> = {
  timeout: '응답이 너무 오래 걸렸습니다.',
  network: '네트워크에 연결하지 못했습니다.',
  invalid_format: '응답 형식을 읽지 못했습니다.',
  upstream: 'AI 서비스에서 오류가 돌아왔습니다.',
  rate_limit: '요청이 많아 잠시 제한되었습니다.',
}

export const AI_CAUTION = 'AI의 해석은 참고용이며 정답이나 점수가 아닙니다.'

/** Cheap identity check so the poll only re-renders when the AI part really changed. */
function sameAi(a: SessionRecord | undefined, b: SessionRecord | undefined): boolean {
  if (!a || !b) return a === b
  return (
    a.ai.status === b.ai.status &&
    a.ai.requestedAt === b.ai.requestedAt &&
    a.ai.respondedAt === b.ai.respondedAt &&
    a.ai.errorCode === b.ai.errorCode
  )
}

function Skeleton({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const elapsed = Math.min(PENDING_DISPLAY_MAX_SEC, Math.max(0, Math.floor((now - startedAt) / 1000)))
  return (
    <div className="ai-pending" role="status" aria-live="polite">
      <p className="label-ko">AI가 결과물을 읽는 중…</p>
      <div className="ai-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="label">
        {elapsed}s / {PENDING_DISPLAY_MAX_SEC}s
      </p>
    </div>
  )
}

function Feedback({ feedback }: { feedback: AiFeedback }) {
  const list = useRef<HTMLDivElement>(null)
  // The five AI cards come in one after another (PRD 10.4). Reduced motion: one short fade.
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MQ.full, () => {
        gsap.fromTo('.ai-card', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: EASE, stagger: 0.15, clearProps: 'opacity,transform' })
      })
      mm.add(MQ.reduced, () => {
        gsap.fromTo('.ai-card', { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: 'opacity' })
      })
    },
    { scope: list },
  )
  const next = feedback.nextChallenge
  const nextActivity = next.activityId ? getActivity(next.activityId) : undefined
  const card = (i: number, title: string, body: ReactNode) => (
    <section className="ai-card" key={i}>
      <h3 className="label">{title}</h3>
      {body}
    </section>
  )
  return (
    <div className="ai-cards" ref={list}>
      {card(0, 'PERFORMANCE SUMMARY', <p>{feedback.summary}</p>)}
      {card(
        1,
        'OBSERVED POINTS',
        <ul className="ai-list">
          {feedback.observedPoints.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>,
      )}
      {card(
        2,
        'STRENGTHS',
        <ul className="ai-list">
          {feedback.strengths.map((s, i) => (
            <li key={i}>
              <strong>{s.point}</strong>
              <q className="ai-evidence">{s.evidence}</q>
            </li>
          ))}
        </ul>,
      )}
      {card(3, 'IMPROVEMENT TIP', <p>{feedback.improvementTip}</p>)}
      {card(
        4,
        'NEXT CHALLENGE',
        <>
          <p>
            <strong>{next.title}</strong>
          </p>
          <p>{next.reason}</p>
          {nextActivity ? (
            <LinkButton href={`#${paths.activity(nextActivity.id)}`} size="sm" variant="ghost">
              {nextActivity.name} 시작
            </LinkButton>
          ) : null}
        </>,
      )}
    </div>
  )
}

interface Props {
  sessionId: string
  /** Inside the archive: no page-level h1 and no DISCOVER/ARCHIVE buttons. */
  embedded?: boolean
}

/**
 * RESULT body (PRD 6-D). Shared by #/result/:id and the archive detail pane.
 * Render with key={sessionId} so state resets when another record is opened.
 */
export function ResultView({ sessionId, embedded = false }: Props) {
  const [session, setSession] = useState<SessionRecord | undefined>(() => getSession(sessionId))
  const { consent, setConsent } = useAiConsent()
  const [notice, setNotice] = useState<string | null>(null)
  const [mountedAt] = useState(() => Date.now())
  const root = useRef<HTMLElement>(null)

  // fromTo everywhere: explicit end values survive StrictMode's double effect run.
  // Entering the result screen (PRD 10.4, ~1.2s): the blocks rise in order and the measured
  // numbers count up. Not in the archive detail pane. Reduced motion: a quick fade, no counting.
  useGSAP(
    () => {
      if (embedded || !root.current) return
      const blocks = '.result__head, .result__block, .ai-panel, .result__actions'
      const mm = gsap.matchMedia()
      mm.add(MQ.full, () => {
        gsap.fromTo(blocks, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE, stagger: 0.15, clearProps: 'opacity,transform' })
        return countUp(root.current!, 0.9)
      })
      mm.add(MQ.reduced, () => {
        gsap.fromTo(blocks, { opacity: 0 }, { opacity: 1, duration: 0.25, clearProps: 'opacity' })
      })
    },
    { scope: root, dependencies: [embedded] },
  )

  const refresh = useCallback(() => {
    setSession((prev) => {
      const next = getSession(sessionId)
      return sameAi(prev, next) ? prev : next
    })
  }, [sessionId])

  const status = session?.ai.status

  // On entry with a pending analysis: ask lib/ai once. The lib de-duplicates (in-flight set and
  // the 30s rule), so StrictMode's second effect run only gets 'in_flight'. Polling picks up the result.
  useEffect(() => {
    if (status !== 'pending') return
    let cancelled = false
    let retryTimer: number | undefined
    void requestAnalysis(sessionId).then((outcome) => {
      refresh()
      // Page was reloaded while a request was recent: wait out the 30s rule once, then ask again.
      if (outcome.state === 'waiting' && !cancelled) {
        retryTimer = window.setTimeout(() => {
          void requestAnalysis(sessionId).then(refresh)
        }, (outcome.waitMs ?? 0) + 100)
      }
    })
    const poll = window.setInterval(refresh, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
    }
  }, [status, sessionId, refresh])

  if (!session) return null

  const activity = getActivity(session.activityId)
  const runRetry = async () => {
    setNotice(null)
    if (consent !== true) setConsent(true) // pressing "analyse this result" is the opt-in
    const running = retryAnalysis(sessionId)
    refresh()
    const outcome = await running
    refresh()
    if (outcome.state === 'skipped') setNotice('AI 분석을 켜지 못했습니다. DISCOVER의 설정을 확인해 주세요.')
  }

  const H = embedded ? 'h2' : 'h1'
  const startedAt = session.ai.requestedAt ? Date.parse(session.ai.requestedAt) : mountedAt

  let aiBody
  switch (session.ai.status) {
    case 'pending':
      aiBody = <Skeleton startedAt={Number.isFinite(startedAt) ? startedAt : mountedAt} />
      break
    case 'success':
      aiBody = session.ai.feedback ? (
        <Feedback feedback={session.ai.feedback} />
      ) : (
        <p>저장된 AI 분석을 읽지 못했습니다.</p>
      )
      break
    case 'failed':
      aiBody = (
        <div className="ai-state">
          <p>AI 분석을 가져오지 못했습니다. 기본 결과는 저장되었습니다.</p>
          {session.ai.errorCode ? <p className="label-ko ai-state__why">{ERROR_TEXT[session.ai.errorCode]}</p> : null}
          <Button variant="ghost" icon={<RotateCcw size={18} aria-hidden="true" />} onClick={() => void runRetry()}>
            다시 분석
          </Button>
        </div>
      )
      break
    default:
      aiBody = (
        <div className="ai-state">
          <p>AI 분석 사용 안 함</p>
          <Button variant="ghost" onClick={() => void runRetry()}>
            이번 결과 분석하기
          </Button>
          <p className="label-ko ai-state__why">누르면 AI 분석을 켜고 이 결과물을 외부 서비스로 보냅니다.</p>
        </div>
      )
  }

  return (
    <article className="result" ref={root} data-accent={activity?.accent} aria-labelledby={`result-title-${sessionId}`}>
      <header className="result__head">
        <H id={`result-title-${sessionId}`} className="display h1 result__title">
          RESULT
        </H>
        <p className="label">
          {activity?.name ?? session.activityId} · {formatDateTime(session.completedAt)}
        </p>
        <div className="chips">
          <Chip>{session.category}</Chip>
          <Chip>{KIND_LABEL[session.kind]}</Chip>
          <Chip>{DIFFICULTY_LABEL[session.difficulty]}</Chip>
          {session.timedOut ? <Chip tone="ink">시간 종료</Chip> : null}
          {session.conditions.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
      </header>

      <section className="result__block" aria-label="내 결과물">
        <h2 className="label result__label">① MY OUTPUT</h2>
        <OutputView session={session} />
      </section>

      <section className="result__block measured" aria-label="측정 지표">
        <div className="measured__head">
          <h2 className="label result__label">② MEASURED</h2>
          <Chip>앱이 계산</Chip>
        </div>
        <MeasuredStats session={session} />
      </section>

      <AiPanel title="AI의 해석">
        {aiBody}
        {notice ? (
          <p className="label-ko" role="alert">
            {notice}
          </p>
        ) : null}
        <p className="ai-panel__caution">{AI_CAUTION}</p>
      </AiPanel>

      <nav className="result__actions" aria-label="다음 행동">
        {activity ? (
          <LinkButton href={`#${paths.activity(activity.id)}`} size="lg">
            TRY AGAIN
          </LinkButton>
        ) : null}
        {embedded ? null : (
          <>
            <LinkButton href={`#${paths.discover()}`} variant="ghost" size="lg">
              DISCOVER
            </LinkButton>
            <LinkButton href={`#${paths.archive()}`} variant="ghost" size="lg">
              ARCHIVE
            </LinkButton>
          </>
        )}
      </nav>
    </article>
  )
}
