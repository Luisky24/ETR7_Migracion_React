import { describe, expect, it } from 'vitest'
import { normalizeOperationError } from '../utils/errorNormalizer'
import { resolveRecoveryPolicy } from '../utils/recoveryPolicy'

describe('errorNormalizer', () => {
  it('maps timeout to retryable infrastructure error', () => {
    const err = normalizeOperationError(new Error('Timeout (30000 ms) esperando respuesta de GAS'))
    expect(err.code).toBe('TIMEOUT')
    expect(err.retryable).toBe(true)
    expect(err.category).toBe('infrastructure')
  })

  it('maps referencia F2 to blocking error', () => {
    const err = normalizeOperationError('Encuentro sin referencia_encuentro')
    expect(err.code).toBe('MISSING_REFERENCIA_F2')
    expect(err.shouldBlock).toBe(true)
  })

  it('recovery policy suggests reload when wire invalid', () => {
    const err = normalizeOperationError('payload corrupto', { code: 'WIRE_INVALID', category: 'wire' })
    const { hints, action } = resolveRecoveryPolicy('error', err, false, false)
    expect(hints.canReload).toBe(true)
    expect(action).toBe('reload')
  })
})
