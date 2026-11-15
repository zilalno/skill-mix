import { Compass } from 'lucide-react'
import { getActivity } from '../activities/registry'
import type { AnyActivity } from '../activities/registry'
import { useActivityRun } from '../activities/useActivityRun'
import { LinkButton } from '../components/Button'
import { ActivityShell } from '../components/ActivityShell'
import { EmptyState } from '../components/EmptyState'
import { paths } from '../router'

function ActivityRunner({ activity }: { activity: AnyActivity }) {
  const { finish } = useActivityRun(activity)
  return <ActivityShell key={activity.id} activity={activity} onFinish={finish} />
}

export function Activity({ id }: { id: string }) {
  const activity = getActivity(id)
  if (!activity) {
    return (
      <main className="page stub">
        <EmptyState
          icon={<Compass size={28} />}
          title="없는 활동입니다"
          body="주소가 잘못되었거나 아직 준비되지 않은 활동입니다."
          action={<LinkButton href={`#${paths.discover()}`}>DISCOVER로 돌아가기</LinkButton>}
        />
      </main>
    )
  }
  return <ActivityRunner activity={activity} />
}
