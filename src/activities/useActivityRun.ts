import { useCallback } from 'react'
import { getAiConsent, saveSessionDetailed } from '../lib/storage'
import { navigate } from '../router'
import { STORAGE_ERROR_EVENT, finishRun } from './finishRun'
import type { FinishDeps, FinishMeta } from './finishRun'
import type { AnyActivity } from './registry'

export type { FinishMeta } from './finishRun'

export interface ActivityRun {
  /** Passed to ActivityShell as onFinish. Called exactly once per run, on submit or timeout. */
  finish: (output: unknown, meta: FinishMeta) => void
}

const deps: FinishDeps = {
  saveSession: saveSessionDetailed,
  getAiConsent,
  navigate,
  now: () => new Date(),
  uuid: () => crypto.randomUUID(),
  onStorageError: (reason) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { reason } }))
    }
  },
}

/**
 * Everything that happens AFTER a submission lives here so the shell stays UI-only:
 * evaluate -> SessionRecord -> save first -> navigate to #/result/:id (see finishRun).
 */
export function useActivityRun(activity: AnyActivity): ActivityRun {
  const finish = useCallback((output: unknown, meta: FinishMeta) => {
    finishRun(activity, output, meta, deps)
  }, [activity])
  return { finish }
}
