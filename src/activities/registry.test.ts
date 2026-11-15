import { describe, expect, it } from 'vitest'
import { ACTIVITIES, getActivity } from './registry'
import { patternFind } from './pattern-find'
import { quickThink } from './quick-think'

describe('registry', () => {
  it('lists the four activities in the agreed order', () => {
    expect(ACTIVITIES.map((a) => a.id)).toEqual(['quick-think', 'pattern-find', 'word-weave', 'shape-mix'])
  })

  it('registers the real QUICK THINK and PATTERN FIND, not the old shells', () => {
    expect(getActivity('quick-think')).toBe(quickThink)
    expect(getActivity('pattern-find')).toBe(patternFind)
  })

  it('still resolves the other activities and unknown ids', () => {
    expect(getActivity('word-weave')?.name).toBe('WORD WEAVE')
    expect(getActivity('shape-mix')?.name).toBe('SHAPE MIX')
    expect(getActivity('nope')).toBeUndefined()
  })

  it('the two finished activities evaluate real input instead of throwing TODO', () => {
    for (const id of ['quick-think', 'pattern-find']) {
      const a = getActivity(id)!
      expect(() => a.evaluate(null, { difficulty: 'normal', elapsedMs: 0, timedOut: false })).not.toThrow()
    }
  })
})
