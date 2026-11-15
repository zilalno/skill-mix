import type { ActivityDefinition, ActivityId } from '../types'
import { patternFind } from './pattern-find'
import { quickThink } from './quick-think'
import { shapeMix } from './shape-mix'
import { wordWeave } from './word-weave'

// Registry holds heterogeneous activities (each with its own output type O),
// so entries are stored as ActivityDefinition<any, any>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyActivity = ActivityDefinition<any, any>

export const ACTIVITIES: AnyActivity[] = [quickThink, patternFind, wordWeave, shapeMix]

/** Accepts any string (it comes from the URL); returns undefined for unknown ids. */
export function getActivity(id: string): AnyActivity | undefined {
  return ACTIVITIES.find((a) => a.id === (id as ActivityId))
}
