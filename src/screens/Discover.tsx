import { useCallback, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { KIND_LABEL } from '../activities/labels'
import { ACTIVITIES } from '../activities/registry'
import { ActivityArt } from '../components/ActivityArt'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Chip } from '../components/Chip'
import { Toast } from '../components/Toast'
import { useAiConsent } from '../lib/useAiConsent'
import { paths } from '../router'

// Extension candidates (PRD 7.5), shown as inactive cards.
const COMING_UP = [
  { name: 'KEY SUMMARY', tagline: '원문을 읽고 핵심을 요약해 보기' },
  { name: 'VISUAL SCAN', tagline: '그림 속에서 대상을 빠르게 찾기' },
]

export function Discover() {
  const { consent, setConsent } = useAiConsent()
  const [toast, setToast] = useState<string | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const choose = (value: boolean) => {
    setConsent(value)
    setToast(value ? 'AI 분석을 사용합니다.' : 'AI 분석을 사용하지 않습니다.')
  }

  return (
    <main className="page discover">
      <div className="discover__head">
        <h1 className="display h1">DISCOVER</h1>
        <p className="prose">하나를 골라 바로 시작하세요. 모든 활동은 1~3분이면 끝납니다.</p>
      </div>

      {consent === null ? (
        <section className="consent on-ink" aria-label="AI 분석 동의">
          <p>
            활동 결과물이 AI 분석을 위해 외부 AI 서비스(OpenRouter)로 전송됩니다. 이름·이메일 등은 수집하지
            않습니다.
          </p>
          <div className="consent__actions">
            <Button onClick={() => choose(true)}>AI 분석 사용</Button>
            <Button variant="ghost" onClick={() => choose(false)}>
              사용 안 함
            </Button>
          </div>
        </section>
      ) : null}

      <div className="discover__grid">
        {ACTIVITIES.map((a) => (
          <Card key={a.id} accent={a.accent} href={`#${paths.activity(a.id)}`} className="discover-card">
            <ActivityArt id={a.id} />
            <div>
              <h2 className="display discover-card__name">{a.name}</h2>
              <p className="discover-card__tagline">{a.tagline}</p>
            </div>
            <div className="chips">
              <Chip>{a.category}</Chip>
              <Chip>{KIND_LABEL[a.kind]}</Chip>
            </div>
            <div className="discover-card__meta label">
              <span>≈ {a.estMinutes} MIN</span>
              <span>
                EASY · <strong>NORMAL</strong> · HARD
              </span>
            </div>
            <span className="discover-card__cta display" aria-hidden="true">
              START <ArrowRight size={28} />
            </span>
          </Card>
        ))}
        {COMING_UP.map((c) => (
          <Card key={c.name} disabled className="discover-card">
            <div>
              <h2 className="display discover-card__name">{c.name}</h2>
              <p className="discover-card__tagline">{c.tagline}</p>
            </div>
            <div className="chips">
              <Chip>COMING UP</Chip>
            </div>
          </Card>
        ))}
      </div>

      <section className="settings" aria-labelledby="ai-setting">
        <h2 id="ai-setting" className="h2">
          AI 분석
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={consent === true}
          className="switch"
          onClick={() => choose(consent !== true)}
        >
          <span className="switch__track">
            <span className="switch__thumb" />
          </span>
          <span className="label-ko">{consent === true ? 'ON' : consent === false ? 'OFF' : '선택 안 함'}</span>
        </button>
        <p className="prose">
          켜 두면 결과 화면에서 활동 결과물을 외부 AI 서비스(OpenRouter)로 보내 관찰 가능한 특징을 설명받습니다.
          끄면 AI 호출 없이 앱이 계산한 수치만 보여 줍니다. 언제든 바꿀 수 있습니다.
        </p>
      </section>

      <Toast message={toast} onClose={closeToast} />
    </main>
  )
}
