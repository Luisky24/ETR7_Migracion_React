import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getDocumentStoreKind,
  getGasTransportKind,
  getRuntimeProfile,
  isLocalDevRuntime,
  isProductionGasRuntime,
  isStagingGasRuntime,
} from './runtimeProfile'

describe('runtimeProfile', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('localDev cuando MODE !== gas', () => {
    vi.stubEnv('MODE', 'development')
    expect(getRuntimeProfile()).toBe('localDev')
    expect(isLocalDevRuntime()).toBe(true)
    expect(getGasTransportKind()).toBe('mock')
    expect(getDocumentStoreKind()).toBe('fakeDrive')
  })

  it('staging-gas cuando MODE=gas y VITE_ETR7_STAGING=true', () => {
    vi.stubEnv('MODE', 'gas')
    vi.stubEnv('VITE_ETR7_STAGING', 'true')
    expect(getRuntimeProfile()).toBe('staging-gas')
    expect(isStagingGasRuntime()).toBe(true)
    expect(getGasTransportKind()).toBe('real')
    expect(getDocumentStoreKind()).toBe('gasDrive')
  })

  it('production cuando MODE=gas sin flag staging', () => {
    vi.stubEnv('MODE', 'gas')
    vi.stubEnv('VITE_ETR7_STAGING', 'false')
    expect(getRuntimeProfile()).toBe('production')
    expect(isProductionGasRuntime()).toBe(true)
    expect(getDocumentStoreKind()).toBe('gasDrive')
  })
})
