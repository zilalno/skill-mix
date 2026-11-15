import { useCallback, useEffect, useState } from 'react'
import { STORAGE_ERROR_EVENT } from '../activities/finishRun'
import { Toast } from './Toast'

const MESSAGES = {
  quota: '저장 공간이 부족해 이번 기록을 저장하지 못했습니다. 이 화면에서는 계속 볼 수 있습니다.',
  unavailable: '브라우저 저장소를 사용할 수 없어 기록이 저장되지 않습니다.',
} as const

/** Shows the PRD 9 "storage full" toast. The app keeps working: the session lives in memory. */
export function StorageNotice() {
  const [message, setMessage] = useState<string | null>(null)
  const close = useCallback(() => setMessage(null), [])

  useEffect(() => {
    const onError = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: keyof typeof MESSAGES }>).detail?.reason
      setMessage(MESSAGES[reason ?? 'unavailable'] ?? MESSAGES.unavailable)
    }
    window.addEventListener(STORAGE_ERROR_EVENT, onError)
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onError)
  }, [])

  return <Toast message={message} onClose={close} durationMs={6000} />
}
