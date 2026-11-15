import { describe, expect, it } from 'vitest'
import type { ActivityId, SessionRecord } from '../types'
import { dateKey, groupByDate, growthSeries, linePoints, niceMax, summarize } from './archive'

const at = (day: number, hour = 12) => new Date(2026, 10, day, hour, 0, 0).toISOString()

function rec(id: string, activityId: ActivityId, completedAt: string, measured: unknown = {}): SessionRecord {
  return {
    id,
    schemaVersion: 1,
    activityId,
    category: 'X',
    kind: 'objective',
    difficulty: 'normal',
    completedAt,
    conditions: [],
    elapsedSec: 10,
    timedOut: false,
    output: {},
    measured,
    labels: [],
    ai: { status: 'skipped' },
  }
}

describe('groupByDate', () => {
  it('groups newest first by local date', () => {
    const groups = groupByDate([
      rec('a', 'quick-think', at(14)),
      rec('b', 'word-weave', at(15, 9)),
      rec('c', 'quick-think', at(15, 18)),
    ])
    expect(groups.map((g) => g.key)).toEqual([dateKey(at(15)), dateKey(at(14))])
    expect(groups[0].sessions.map((s) => s.id)).toEqual(['c', 'b'])
  })
  it('returns [] for no sessions', () => {
    expect(groupByDate([])).toEqual([])
  })
})

describe('summarize', () => {
  const now = new Date(2026, 10, 15, 20, 0, 0).getTime()
  it('counts total, last 7 days and the most played activity', () => {
    const s = summarize(
      [
        rec('a', 'quick-think', at(15)),
        rec('b', 'quick-think', at(10)),
        rec('c', 'word-weave', at(1)),
        rec('d', 'quick-think', at(2)),
      ],
      now,
    )
    expect(s.total).toBe(4)
    expect(s.last7Days).toBe(2)
    expect(s.most).toEqual({ activityId: 'quick-think', count: 3 })
  })
  it('handles an empty list', () => {
    expect(summarize([], now)).toEqual({ total: 0, last7Days: 0, most: null })
  })
  it('breaks ties by the more recent activity', () => {
    const s = summarize([rec('a', 'quick-think', at(1)), rec('b', 'shape-mix', at(5))], now)
    expect(s.most?.activityId).toBe('shape-mix')
  })
})

describe('growthSeries', () => {
  it('uses one activity only, oldest first, and skips records without both numbers', () => {
    const series = growthSeries(
      [
        rec('new', 'quick-think', at(15), { accuracyPct: 80, avgSec: 3.2 }),
        rec('old', 'quick-think', at(10), { accuracyPct: 60, avgSec: 4 }),
        rec('other', 'pattern-find', at(12), { accuracyPct: 100, avgSec: 1 }),
        rec('bad', 'quick-think', at(11), { accuracyPct: 'x' }),
      ],
      'quick-think',
    )
    expect(series.map((p) => p.id)).toEqual(['old', 'new'])
  })
})

describe('chart math', () => {
  it('maps values into the plot box', () => {
    const pts = linePoints([0, 50, 100], { x: 10, y: 0, w: 100, h: 100 }, 100)
    expect(pts).toEqual([
      { x: 10, y: 100 },
      { x: 60, y: 50 },
      { x: 110, y: 0 },
    ])
  })
  it('centres a single point', () => {
    expect(linePoints([40], { x: 0, y: 0, w: 100, h: 100 }, 100)[0].x).toBe(50)
  })
  it('niceMax rounds up to a tidy axis end', () => {
    expect(niceMax(0)).toBe(1)
    expect(niceMax(3.2)).toBe(5)
    expect(niceMax(7)).toBe(10)
    expect(niceMax(12)).toBe(20)
  })
})
