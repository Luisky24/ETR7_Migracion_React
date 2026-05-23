import { describe, expect, it } from 'vitest'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import { normalizeOperationError } from '../utils/errorNormalizer'
import { resolveRecoveryPolicy } from '../utils/recoveryPolicy'
import { emptyMatchReport } from './fixtures'

function failurePayload(message: string) {
  const operationError = normalizeOperationError(message)
  const { hints } = resolveRecoveryPolicy('loaded', operationError, true, true)
  return { error: operationError.userMessage, operationError, recovery: hints }
}

describe('dirty state recovery', () => {
  it('SAVE_DRAFT_FAILURE keeps report and dirty', () => {
    const report = emptyMatchReport()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: { report, cerrada: false, fromActaSnapshot: false } },
    })
    state = { ...state, dirty: true, operation: 'loaded' }
    state = matchReportReducer(state, {
      type: 'SAVE_DRAFT_FAILURE',
      payload: failurePayload('Timeout GAS'),
    })
    expect(state.report).not.toBeNull()
    expect(state.dirty).toBe(true)
    expect(state.operation).toBe('loaded')
    expect(state.recovery?.canRetrySave).toBe(true)
  })

  it('FINALIZE_REPORT_FAILURE does not close acta', () => {
    const report = emptyMatchReport()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: { report, cerrada: false, fromActaSnapshot: false } },
    })
    state = matchReportReducer(state, {
      type: 'FINALIZE_REPORT_FAILURE',
      payload: {
        result: { ok: false, cerrada: false, errorCode: 'SERVER_ERROR', message: 'Error' },
        ...failurePayload('Error servidor'),
      },
    })
    expect(state.report?.cerrada).toBe(false)
    expect(state.operation).toBe('loaded')
  })

  it('FINALIZE_REPORT_FAILURE con error retryable expone canRetryFinalize (R1)', () => {
    const report = emptyMatchReport()
    const operationError = normalizeOperationError('Timeout GAS')
    const { hints } = resolveRecoveryPolicy('finalizing', operationError, true, true)

    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: { report, cerrada: false, fromActaSnapshot: false } },
    })
    state = { ...state, dirty: true }
    state = matchReportReducer(state, {
      type: 'FINALIZE_REPORT_FAILURE',
      payload: {
        result: { ok: false, cerrada: false, errorCode: 'SERVER_ERROR', message: 'Timeout GAS' },
        operationError,
        recovery: hints,
      },
    })
    expect(state.recovery?.canRetryFinalize).toBe(true)
  })

  it('RESET_REPORT restores snapshot after failed save', () => {
    const report = emptyMatchReport()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: { report, cerrada: false, fromActaSnapshot: false } },
    })
    const snapshot = state.savedSnapshot!
    state = matchReportReducer(state, { type: 'RESET_REPORT' })
    expect(state.report).toEqual(snapshot)
    expect(state.dirty).toBe(false)
  })
})
