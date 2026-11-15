import { createContext, useContext, useEffect, useRef } from 'react'

export type OutputGetter = () => unknown

interface Bridge {
  register: (getter: OutputGetter | null) => void
}

/** Provided by ActivityShell around <Stage>. Leaf module on purpose: Stage files import it,
 *  and the registry imports Stage files, so it must not import the shell or the registry. */
export const StageBridge = createContext<Bridge | null>(null)

/**
 * A Stage calls this once so the shell can submit its *current* output when the timer hits 0
 * or the footer's submit button is pressed. StageProps itself stays exactly as in PRD 8.2.
 * A Stage that does not call it is submitted as `null` by the shell's own buttons
 * (it can still call `onSubmit` itself).
 */
export function useStageOutput(getOutput: OutputGetter): void {
  const bridge = useContext(StageBridge)
  const latest = useRef(getOutput)
  useEffect(() => {
    latest.current = getOutput
  })
  useEffect(() => {
    bridge?.register(() => latest.current())
    return () => bridge?.register(null)
  }, [bridge])
}
