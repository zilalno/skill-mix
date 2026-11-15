import { useMemo } from 'react'
import { FileQuestion } from 'lucide-react'
import { LinkButton } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { ResultView } from '../components/ResultView'
import { getSession } from '../lib/storage'
import { paths } from '../router'

export function Result({ sessionId }: { sessionId: string }) {
  const exists = useMemo(() => getSession(sessionId) !== undefined, [sessionId])

  if (!exists) {
    return (
      <main className="page result-page">
        <EmptyState
          icon={<FileQuestion size={28} />}
          title="결과를 찾을 수 없습니다"
          body="삭제되었거나 이 브라우저에 저장되지 않은 기록입니다."
          action={<LinkButton href={`#${paths.discover()}`}>DISCOVER</LinkButton>}
        />
      </main>
    )
  }

  return (
    <main className="page result-page">
      <ResultView key={sessionId} sessionId={sessionId} />
    </main>
  )
}
