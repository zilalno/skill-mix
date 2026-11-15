// AI client (PRD 8, 9, 11.2). Signatures are the shared contract; bodies are TODO.
import type { AiActivityPayload, AiErrorCode, AiFeedback } from '../types'

export type AnalyzeResult =
  | { ok: true; feedback: AiFeedback; model?: string }
  | { ok: false; errorCode: AiErrorCode }

/** POST /api/analyze. Client timeout 28s -> 'timeout'. With VITE_AI_MOCK=1 returns a fixed mock (dev only). */
export function fetchAnalysis(_payload: AiActivityPayload, _signal?: AbortSignal): Promise<AnalyzeResult> {
  throw new Error('TODO: fetchAnalysis')
}

/**
 * Called on RESULT entry. If the session is `pending` and not in flight (module-level
 * `inFlight` Set + `ai.status`; wait if requestedAt < 30s ago), calls fetchAnalysis once
 * and writes the outcome to storage via updateSessionAi().
 */
export function analyzeSession(_sessionId: string): Promise<void> {
  throw new Error('TODO: analyzeSession')
}

export function isInFlight(_sessionId: string): boolean {
  throw new Error('TODO: isInFlight')
}
