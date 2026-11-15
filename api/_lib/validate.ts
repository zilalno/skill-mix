import type { AiActivityPayload } from '../../src/types'
import { ACTIVITY_IDS, ACTIVITY_META, DIFFICULTIES, KINDS, LIMITS } from './constants.js'

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

// Whitelist of top-level fields (PRD 8.3). Anything else is rejected, not silently kept.
const ALLOWED_KEYS = new Set([
  'activityId',
  'activityName',
  'category',
  'kind',
  'difficulty',
  'conditions',
  'elapsedSec',
  'measured',
  'userOutput',
  'rubric',
  'knownReference',
])

const KEY_RE = /^[A-Za-z0-9_-]{1,40}$/
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const badKey = (k: string) => !KEY_RE.test(k) || FORBIDDEN_KEYS.has(k)

/** Generic bounded-JSON check for free-form fields (userOutput, knownReference). */
function checkJson(value: unknown, depth: number, budget: { nodes: number }, path: string): string | null {
  if (++budget.nodes > LIMITS.jsonNodes) return `${path}: too many nodes`
  if (value === null || typeof value === 'boolean') return null
  if (typeof value === 'number') return Number.isFinite(value) ? null : `${path}: non-finite number`
  if (typeof value === 'string') return value.length <= LIMITS.jsonStringChars ? null : `${path}: string too long`
  if (depth >= LIMITS.jsonDepth) return `${path}: too deep`
  if (Array.isArray(value)) {
    if (value.length > LIMITS.jsonArrayItems) return `${path}: array too long`
    for (let i = 0; i < value.length; i++) {
      const err = checkJson(value[i], depth + 1, budget, `${path}[${i}]`)
      if (err) return err
    }
    return null
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
    if (keys.length > LIMITS.jsonObjectKeys) return `${path}: too many keys`
    for (const k of keys) {
      if (badKey(k)) return `${path}: bad key`
      const err = checkJson(value[k], depth + 1, budget, `${path}.${k}`)
      if (err) return err
    }
    return null
  }
  return `${path}: unsupported type`
}

function stringList(value: unknown, maxItems: number, maxChars: number, name: string): Validation<string[]> {
  if (!Array.isArray(value)) return fail(`${name}: must be an array`)
  if (value.length > maxItems) return fail(`${name}: too many items`)
  for (const item of value) {
    if (typeof item !== 'string' || item.length > maxChars) return fail(`${name}: bad item`)
  }
  return { ok: true, value: value as string[] }
}

function measuredRecord(value: unknown): Validation<Record<string, number | string | boolean>> {
  if (!isPlainObject(value)) return fail('measured: must be an object')
  const keys = Object.keys(value)
  if (keys.length > LIMITS.measuredKeys) return fail('measured: too many keys')
  for (const k of keys) {
    if (badKey(k)) return fail('measured: bad key')
    const v = value[k]
    const ok =
      typeof v === 'boolean' ||
      (typeof v === 'number' && Number.isFinite(v)) ||
      (typeof v === 'string' && v.length <= LIMITS.measuredStringChars)
    if (!ok) return fail(`measured.${k}: bad value`)
  }
  return { ok: true, value: value as Record<string, number | string | boolean> }
}

const optionalShortString = (v: unknown) =>
  v === undefined || (typeof v === 'string' && v.length <= LIMITS.shortString)

/**
 * Validates a client request against the PRD 8.3 whitelist and returns a normalised payload.
 * activityName/category/kind are NOT taken from the client: the server's canonical values
 * for the given activityId are used, so those fields cannot carry injected text.
 */
export function validateAnalyzeRequest(body: unknown): Validation<AiActivityPayload> {
  if (!isPlainObject(body)) return fail('body: must be an object')

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) return fail(`unknown field: ${key}`)
  }

  const { activityId, difficulty, elapsedSec } = body
  if (typeof activityId !== 'string' || !(ACTIVITY_IDS as string[]).includes(activityId)) {
    return fail('activityId: not allowed')
  }
  const id = activityId as keyof typeof ACTIVITY_META
  if (typeof difficulty !== 'string' || !(DIFFICULTIES as readonly string[]).includes(difficulty)) {
    return fail('difficulty: not allowed')
  }
  if (!optionalShortString(body.activityName) || !optionalShortString(body.category)) {
    return fail('echo fields: bad value')
  }
  if (body.kind !== undefined && !(KINDS as readonly unknown[]).includes(body.kind)) {
    return fail('kind: not allowed')
  }
  if (typeof elapsedSec !== 'number' || !Number.isFinite(elapsedSec) || elapsedSec < 0 || elapsedSec > LIMITS.maxElapsedSec) {
    return fail('elapsedSec: out of range')
  }

  const conditions = stringList(body.conditions, LIMITS.conditionItems, LIMITS.conditionChars, 'conditions')
  if (!conditions.ok) return conditions
  const rubric = stringList(body.rubric, LIMITS.rubricItems, LIMITS.rubricChars, 'rubric')
  if (!rubric.ok) return rubric
  const measured = measuredRecord(body.measured)
  if (!measured.ok) return measured

  if (!('userOutput' in body)) return fail('userOutput: required')
  const outputErr = checkJson(body.userOutput, 0, { nodes: 0 }, 'userOutput')
  if (outputErr) return fail(outputErr)

  const knownReference = body.knownReference ?? null
  const refErr = checkJson(knownReference, 0, { nodes: 0 }, 'knownReference')
  if (refErr) return fail(refErr)

  const meta = ACTIVITY_META[id]
  return {
    ok: true,
    value: {
      activityId: id,
      activityName: meta.name,
      category: meta.category,
      kind: meta.kind,
      difficulty: difficulty as AiActivityPayload['difficulty'],
      conditions: conditions.value,
      elapsedSec,
      measured: measured.value,
      userOutput: body.userOutput,
      rubric: rubric.value,
      knownReference,
    },
  }
}
