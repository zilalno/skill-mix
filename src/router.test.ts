import { describe, expect, it } from 'vitest'
import { parseRoute, paths } from './router'

describe('parseRoute', () => {
  it.each(['', '#', '#/', '/'])('maps %j to landing', (hash) => {
    expect(parseRoute(hash)).toEqual({ name: 'landing' })
  })

  it('parses static routes', () => {
    expect(parseRoute('#/discover')).toEqual({ name: 'discover' })
    expect(parseRoute('#/archive')).toEqual({ name: 'archive' })
  })

  it('parses parameterised routes', () => {
    expect(parseRoute('#/activity/word-weave')).toEqual({ name: 'activity', id: 'word-weave' })
    expect(parseRoute('#/result/abc-123')).toEqual({ name: 'result', sessionId: 'abc-123' })
  })

  it('tolerates trailing slash and query string', () => {
    expect(parseRoute('#/discover/')).toEqual({ name: 'discover' })
    expect(parseRoute('#/activity/shape-mix?debug=1')).toEqual({ name: 'activity', id: 'shape-mix' })
  })

  it('decodes params and survives malformed encoding', () => {
    expect(parseRoute('#/result/a%20b')).toEqual({ name: 'result', sessionId: 'a b' })
    expect(parseRoute('#/result/%E0%A4%A')).toEqual({ name: 'result', sessionId: '%E0%A4%A' })
  })

  it('returns not-found for unknown or malformed paths', () => {
    expect(parseRoute('#/nope')).toEqual({ name: 'not-found' })
    expect(parseRoute('#/activity')).toEqual({ name: 'not-found' })
    expect(parseRoute('#/activity/a/b')).toEqual({ name: 'not-found' })
    expect(parseRoute('#/discover/extra')).toEqual({ name: 'not-found' })
  })
})

describe('paths', () => {
  it('round-trips through parseRoute', () => {
    expect(parseRoute(`#${paths.activity('quick-think')}`)).toEqual({ name: 'activity', id: 'quick-think' })
    expect(parseRoute(`#${paths.result('x y')}`)).toEqual({ name: 'result', sessionId: 'x y' })
    expect(parseRoute(`#${paths.landing()}`)).toEqual({ name: 'landing' })
  })
})
