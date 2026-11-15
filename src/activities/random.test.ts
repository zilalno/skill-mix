import { describe, expect, it } from 'vitest'
import { mulberry32, newSeed, randomInt, shuffle } from './random'

describe('mulberry32', () => {
  it('gives the same sequence for the same seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    expect(Array.from({ length: 20 }, () => a())).toEqual(Array.from({ length: 20 }, () => b()))
  })

  it('gives different sequences for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(Array.from({ length: 5 }, () => a())).not.toEqual(Array.from({ length: 5 }, () => b()))
  })

  it('stays in [0, 1)', () => {
    const r = mulberry32(99)
    for (let i = 0; i < 5000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('randomInt', () => {
  it('covers both ends and never leaves the range', () => {
    const r = mulberry32(7)
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const v = randomInt(r, 3, 6)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(6)
      seen.add(v)
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6])
  })

  it('returns the only value when min equals max', () => {
    expect(randomInt(mulberry32(1), 5, 5)).toBe(5)
  })
})

describe('shuffle', () => {
  it('returns a permutation and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5, 6]
    const out = shuffle(input, mulberry32(3))
    expect(input).toEqual([1, 2, 3, 4, 5, 6])
    expect([...out].sort()).toEqual(input)
  })

  it('is deterministic for a seed', () => {
    expect(shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(5))).toEqual(shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(5)))
  })
})

describe('newSeed', () => {
  it('is an unsigned 32-bit integer', () => {
    const s = newSeed()
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThan(2 ** 32)
  })
})
