import type { ActivityKind, Difficulty } from '../types'

// PRD 6-B lists OBJECTIVE/OPEN chips; PATTERN FIND is 'hybrid', which the PRD does not name.
export const KIND_LABEL: Record<ActivityKind, string> = {
  objective: 'OBJECTIVE',
  hybrid: 'HYBRID',
  open: 'OPEN',
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'EASY',
  normal: 'NORMAL',
  hard: 'HARD',
}
