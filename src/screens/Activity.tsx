import { getActivity } from '../activities/registry'

export function Activity({ id }: { id: string }) {
  const activity = getActivity(id)
  return <h1>{activity ? `ACTIVITY — ${activity.name}` : `ACTIVITY — unknown "${id}"`}</h1>
}
