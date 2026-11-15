import { useCallback, useState } from 'react'
import { loadSettings, saveSettings } from './storage'

/**
 * AI consent (PRD 5): null = not asked yet. Backed by lib/storage settings.
 * Storage never throws: if the write fails the choice still applies for this visit.
 */
export function useAiConsent(): { consent: boolean | null; setConsent: (value: boolean) => void } {
  const [consent, setState] = useState<boolean | null>(() => loadSettings().aiConsent)

  const setConsent = useCallback((value: boolean) => {
    setState(value)
    if (!saveSettings({ schemaVersion: 1, aiConsent: value })) {
      console.warn('[useAiConsent] could not persist the choice; it applies for this visit only')
    }
  }, [])

  return { consent, setConsent }
}
