import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { matchContextLoadKey, matchReportSearchKey } from '../utils/matchReportQuery'
import { baseContext } from './fixtures'
import {
  matchReportRuntimeLog,
  resetMatchReportRuntimeLogDedupeForTests,
} from '../utils/runtimeLogger'
import * as debugModule from '@/core/debug'

describe('render stability (QA-A2)', () => {
  beforeEach(() => {
    resetMatchReportRuntimeLogDedupeForTests()
    vi.spyOn(debugModule, 'isEtr7DebugLoggingEnabled').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('matchContextLoadKey is stable for same encounter', () => {
    const ctx = baseContext()
    expect(matchContextLoadKey(ctx)).toBe(matchContextLoadKey({ ...ctx }))
  })

  it('matchReportSearchKey ignores URLSearchParams object identity', () => {
    const a = new URLSearchParams('categoria=M&fase=Fase+I&rk=A%7CL%7CV')
    const b = new URLSearchParams('categoria=M&fase=Fase+I&rk=A%7CL%7CV')
    expect(matchReportSearchKey(a)).toBe(matchReportSearchKey(b))
  })

  it('runtimeLogger dedupes repeated operation logs', () => {
    vi.useFakeTimers()
    const scopes: string[] = []
    vi.spyOn(console, 'debug').mockImplementation((...args: unknown[]) => {
      scopes.push(String(args[1]))
    })
    matchReportRuntimeLog.operation('load.skipped', { operation: 'loaded' })
    matchReportRuntimeLog.operation('load.skipped', { operation: 'loaded' })
    const immediate = scopes.filter((s) => s.includes('load.skipped'))
    expect(immediate.length).toBe(1)
    vi.advanceTimersByTime(2_500)
    matchReportRuntimeLog.operation('load.skipped', { operation: 'loaded' })
    const afterWindow = scopes.filter((s) => s.includes('load.skipped'))
    expect(afterWindow.length).toBe(2)
    vi.useRealTimers()
  })
})

describe('load callback stability', () => {
  it('documents idempotent hydrate: same loadKey must not re-fetch', () => {
    const ctx = baseContext()
    const key = matchContextLoadKey(ctx)
    const seen = new Set<string>()
    const simulatePageEffect = (currentKey: string) => {
      if (seen.has(currentKey)) return false
      seen.add(currentKey)
      return true
    }
    expect(simulatePageEffect(key)).toBe(true)
    expect(simulatePageEffect(key)).toBe(false)
  })
})
