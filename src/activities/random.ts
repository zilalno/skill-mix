export type Rng = () => number

/** Small seeded PRNG (mulberry32): the same seed always gives the same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A fresh random seed for a new run (the only non-deterministic input). */
export const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]

/** Integer in [min, max], both inclusive. */
export const randomInt = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1))

/** Fisher-Yates on a copy. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
