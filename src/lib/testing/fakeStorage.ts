/**
 * In-memory stand-in for window.localStorage so storage code can be tested in plain Node
 * (no DOM environment is installed). Tests install it with vi.stubGlobal('localStorage', ...).
 */
export class FakeStorage {
  private data = new Map<string, string>()
  /** When set, every setItem throws (simulating a full or locked store). */
  failWrites: 'quota' | 'security' | null = null
  /** Optional total size cap in characters (keys + values); exceeding it throws a quota error. */
  maxChars: number | null = null

  get length(): number {
    return this.data.size
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites === 'quota') throw new DOMException('storage is full', 'QuotaExceededError')
    if (this.failWrites === 'security') throw new DOMException('denied', 'SecurityError')
    if (this.maxChars !== null) {
      let total = key.length + value.length
      for (const [k, v] of this.data) if (k !== key) total += k.length + v.length
      if (total > this.maxChars) throw new DOMException('storage is full', 'QuotaExceededError')
    }
    this.data.set(key, String(value))
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  clear(): void {
    this.data.clear()
  }

  /** Test helper: keys currently stored. */
  keys(): string[] {
    return [...this.data.keys()]
  }
}
