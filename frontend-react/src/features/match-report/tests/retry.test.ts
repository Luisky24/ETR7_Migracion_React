import { describe, expect, it, vi } from 'vitest'
import { createQaSimulatedError } from '../utils/qaRuntimeSimulation'
import { executeWithRetry } from '../utils/retryOperation'

describe('executeWithRetry', () => {
  it('retries retryable errors', async () => {
    let calls = 0
    const result = await executeWithRetry(
      async () => {
        calls++
        if (calls < 2) throw new Error('Timeout esperando GAS')
        return 'ok'
      },
      'testOp',
      { maxAttempts: 3, delayMs: 1 },
    )
    expect(result).toBe('ok')
    expect(calls).toBe(2)
  })

  it('does not retry validation errors', async () => {
    let calls = 0
    await expect(
      executeWithRetry(
        async () => {
          calls++
          throw new Error('Validación de cierre fallida')
        },
        'testOp',
        { maxAttempts: 3, delayMs: 1 },
      ),
    ).rejects.toThrow()
    expect(calls).toBe(1)
  })

  it('no reintenta errores simulados QA (retry manual)', async () => {
    const fn = vi.fn().mockRejectedValue(createQaSimulatedError('save', 'recoverable'))
    await expect(executeWithRetry(fn, 'saveDraft', { maxAttempts: 3, delayMs: 1 })).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('respects maxAttempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Timeout GAS'))
    await expect(
      executeWithRetry(fn, 'failOp', { maxAttempts: 2, delayMs: 1 }),
    ).rejects.toThrow('Timeout')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
