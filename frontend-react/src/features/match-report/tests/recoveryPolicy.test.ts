import { describe, expect, it } from 'vitest'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import { selectCanRetryFinalize } from '../selectors/matchReportOperationSelectors'
import { normalizeOperationError } from '../utils/errorNormalizer'
import { resolveRecoveryPolicy } from '../utils/recoveryPolicy'
import { emptyMatchReport } from './fixtures'

describe('resolveRecoveryPolicy — finalize retry (R1)', () => {
  const retryableCloseError = normalizeOperationError(
    new Error('Timeout (30000 ms) esperando respuesta de GAS'),
  )
  const fatalError = normalizeOperationError('Encuentro sin referencia_encuentro')

  it('muestra retry finalize tras fallo de cierre en loaded con dirty', () => {
    const { hints } = resolveRecoveryPolicy('loaded', retryableCloseError, true, true, {
      failedOperation: 'finalize',
    })
    expect(hints.canRetryFinalize).toBe(true)
    expect(hints.preserveDirty).toBe(true)
  })

  it('muestra retry finalize cuando la operación en curso es finalizing', () => {
    const { hints } = resolveRecoveryPolicy('finalizing', retryableCloseError, true, true)
    expect(hints.canRetryFinalize).toBe(true)
  })

  it('oculta retry finalize tras lock (operación locked)', () => {
    const { hints } = resolveRecoveryPolicy('locked', retryableCloseError, true, true, {
      failedOperation: 'finalize',
    })
    expect(hints.canRetryFinalize).toBe(false)
  })

  it('oculta retry finalize tras finalize real (operación finalized)', () => {
    const { hints } = resolveRecoveryPolicy('finalized', retryableCloseError, true, true, {
      failedOperation: 'finalize',
    })
    expect(hints.canRetryFinalize).toBe(false)
  })

  it('oculta retry finalize en fatalError bloqueante', () => {
    const { hints } = resolveRecoveryPolicy('loaded', fatalError, true, true, {
      failedOperation: 'finalize',
    })
    expect(hints.canRetryFinalize).toBe(false)
    expect(hints.canRetrySave).toBe(false)
  })

  it('oculta retry finalize sin dirty aunque el error sea retryable', () => {
    const { hints } = resolveRecoveryPolicy('loaded', retryableCloseError, true, false, {
      failedOperation: 'finalize',
    })
    expect(hints.canRetryFinalize).toBe(false)
  })

  it('no ofrece retry finalize en fallo de guardado (solo save)', () => {
    const { hints } = resolveRecoveryPolicy('loaded', retryableCloseError, true, true, {
      failedOperation: 'save',
    })
    expect(hints.canRetrySave).toBe(true)
    expect(hints.canRetryFinalize).toBe(false)
  })
})

describe('FINALIZE_REPORT_FAILURE + selectCanRetryFinalize', () => {
  it('expone Reintentar cerrar en banner tras fallo recuperable de cierre', () => {
    const report = emptyMatchReport()
    const operationError = normalizeOperationError('Timeout GAS')
    const { hints } = resolveRecoveryPolicy('finalizing', operationError, true, true)

    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: { report, cerrada: false, fromActaSnapshot: false } },
    })
    state = { ...state, dirty: true, operation: 'loaded' }
    state = matchReportReducer(state, {
      type: 'FINALIZE_REPORT_FAILURE',
      payload: {
        result: { ok: false, cerrada: false, errorCode: 'SERVER_ERROR', message: 'Timeout GAS' },
        operationError,
        recovery: hints,
      },
    })

    expect(state.operation).toBe('loaded')
    expect(state.dirty).toBe(true)
    expect(state.report?.cerrada).toBe(false)
    expect(selectCanRetryFinalize(state)).toBe(true)
  })
})
