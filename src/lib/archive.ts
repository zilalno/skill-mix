// Pure helpers for the ARCHIVE screen (PRD 6-E). No React, no storage access.
import type { ActivityId, SessionRecord } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date key, e.g. '2026-11-15'. Invalid dates give ''. */
export function dateKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** '2026-11-15 13:40' in local time. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${dateKey(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** '11/15' for a date key. */
export function shortDate(key: string): string {
  const [, m, d] = key.split('-')
  return m && d ? `${Number(m)}/${Number(d)}` : '—'
}

export interface DateGroup {
  key: string
  sessions: SessionRecord[]
}

/** Newest first, grouped by local date. Input order is not trusted. */
export function groupByDate(sessions: SessionRecord[]): DateGroup[] {
  const sorted = [...sessions].sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0))
  const groups: DateGroup[] = []
  for (const s of sorted) {
    const key = dateKey(s.completedAt)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.sessions.push(s)
    else groups.push({ key, sessions: [s] })
  }
  return groups
}

export interface ArchiveSummary {
  total: number
  last7Days: number
  /** Most played activity, ties broken by the more recent one. null when there are no records. */
  most: { activityId: ActivityId; count: number } | null
}

export function summarize(sessions: SessionRecord[], now: number = Date.now()): ArchiveSummary {
  const counts = new Map<ActivityId, number>()
  const latest = new Map<ActivityId, string>()
  let last7Days = 0
  for (const s of sessions) {
    counts.set(s.activityId, (counts.get(s.activityId) ?? 0) + 1)
    if ((latest.get(s.activityId) ?? '') < s.completedAt) latest.set(s.activityId, s.completedAt)
    const t = Date.parse(s.completedAt)
    if (Number.isFinite(t) && t <= now && now - t < 7 * DAY_MS) last7Days++
  }
  let most: ArchiveSummary['most'] = null
  for (const [activityId, count] of counts) {
    if (
      !most ||
      count > most.count ||
      (count === most.count && (latest.get(activityId) ?? '') > (latest.get(most.activityId) ?? ''))
    ) {
      most = { activityId, count }
    }
  }
  return { total: sessions.length, last7Days, most }
}

export interface GrowthPoint {
  id: string
  completedAt: string
  accuracyPct: number
  avgSec: number
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/**
 * Accuracy and average response time of ONE activity, oldest first. Records of other activities
 * are ignored and records without both numbers are skipped: there is no cross-activity total.
 */
export function growthSeries(sessions: SessionRecord[], activityId: ActivityId): GrowthPoint[] {
  const points: GrowthPoint[] = []
  for (const s of sessions) {
    if (s.activityId !== activityId) continue
    const m = typeof s.measured === 'object' && s.measured !== null ? (s.measured as Record<string, unknown>) : {}
    const accuracyPct = num(m.accuracyPct)
    const avgSec = num(m.avgSec)
    if (accuracyPct === undefined || avgSec === undefined) continue
    points.push({ id: s.id, completedAt: s.completedAt, accuracyPct, avgSec })
  }
  return points.sort((a, b) => (a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : 0))
}

/** Screen coordinates for a line chart. `values` map onto [0,max] (min fixed at 0) inside the plot box. */
export function linePoints(
  values: number[],
  box: { x: number; y: number; w: number; h: number },
  max: number,
): { x: number; y: number }[] {
  const top = max > 0 ? max : 1
  return values.map((v, i) => ({
    x: values.length === 1 ? box.x + box.w / 2 : box.x + (box.w * i) / (values.length - 1),
    y: box.y + box.h - (Math.min(Math.max(v, 0), top) / top) * box.h,
  }))
}

/** Smallest "nice" axis maximum at or above `value` (1, 2, 5, 10 × 10^n). */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1
  const exp = Math.floor(Math.log10(value))
  const base = 10 ** exp
  for (const step of [1, 2, 5, 10]) if (value <= step * base) return step * base
  return 10 * base
}
