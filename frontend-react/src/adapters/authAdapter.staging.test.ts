import { afterEach, describe, expect, it, vi } from 'vitest'
import { authLogin } from './authAdapter'
import { LOCAL_DEV_CREDENTIAL_HINT } from '@/transport/localDev/mockAuthLogin'

describe('authLogin staging GAS', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rechaza credencial local-dev cuando MODE=gas', async () => {
    vi.stubEnv('MODE', 'gas')
    const result = await authLogin({ credential: LOCAL_DEV_CREDENTIAL_HINT })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('AUTH_INVALID')
    }
  })
})
