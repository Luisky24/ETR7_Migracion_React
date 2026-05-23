import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setMatchReportServiceMode } from '@/features/match-report/services/matchReport.service'
import {
  assertRuntimeEnvironment,
  getRuntimeEnvironmentSnapshot,
  shouldShowLocalDevJsonWarning,
  shouldShowStagingEnvironmentBanner,
} from './runtimeEnvironment'

describe('runtimeEnvironment', () => {
  beforeEach(() => {
    setMatchReportServiceMode('mock')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    setMatchReportServiceMode('mock')
  })

  it('1. .env.gas — hybrid persistence when env set', () => {
    vi.stubEnv('VITE_ETR7_ACTA_PERSISTENCE', 'hybrid')
    expect(getRuntimeEnvironmentSnapshot().persistence).toBe('hybrid')
  })

  it('2. startup snapshot exposes MODE and persistence', () => {
    vi.stubEnv('MODE', 'gas')
    vi.stubEnv('VITE_ETR7_ACTA_PERSISTENCE', 'hybrid')
    setMatchReportServiceMode('gas')
    const s = getRuntimeEnvironmentSnapshot()
    expect(s.viteMode).toBe('gas')
    expect(s.persistence).toBe('hybrid')
    expect(s.matchReportService).toBe('gas')
  })

  it('3. staging banner visible on gas + hybrid + staging flag', () => {
    vi.stubEnv('MODE', 'gas')
    vi.stubEnv('VITE_ETR7_ACTA_PERSISTENCE', 'hybrid')
    vi.stubEnv('VITE_ETR7_STAGING', 'true')
    expect(shouldShowStagingEnvironmentBanner()).toBe(true)
  })

  it('4. staging banner hidden when MODE is not gas', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_ETR7_ACTA_PERSISTENCE', 'hybrid')
    vi.stubEnv('VITE_ETR7_STAGING', 'true')
    expect(shouldShowStagingEnvironmentBanner()).toBe(false)
  })

  it('5. local-dev JSON warning when MODE !== gas and hybrid', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_ETR7_ACTA_PERSISTENCE', 'hybrid')
    expect(shouldShowLocalDevJsonWarning()).toBe(true)
  })

  it('6. assertRuntimeEnvironment detects local dev + json persistence', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_ETR7_ACTA_PERSISTENCE', 'hybrid')
    const issues = assertRuntimeEnvironment()
    expect(issues.some((i) => i.code === 'LOCAL_DEV_WITH_JSON_PERSISTENCE')).toBe(true)
  })

  it('7. MODE=gas snapshot uses real transport labels', () => {
    vi.stubEnv('MODE', 'gas')
    vi.stubEnv('VITE_ETR7_ACTA_PERSISTENCE', 'hybrid')
    setMatchReportServiceMode('gas')
    const s = getRuntimeEnvironmentSnapshot()
    expect(s.gasTransport).toBe('real')
    expect(s.calendarSync).toBe('real')
    expect(s.actaRepository).toBe('Drive/GAS')
  })

  it('8. persistence legacy on gas build yields info issue', () => {
    vi.stubEnv('MODE', 'gas')
    vi.stubEnv('VITE_ETR7_ACTA_PERSISTENCE', 'legacy')
    setMatchReportServiceMode('gas')
    const issues = assertRuntimeEnvironment()
    expect(issues.some((i) => i.code === 'LEGACY_PERSISTENCE_ON_GAS_BUILD')).toBe(true)
  })
})
