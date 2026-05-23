import { describe, expect, it } from 'vitest'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import {
  selectCanEdit,
  selectClassificationRows,
  selectDirtyFieldKeys,
  selectHasRecoverableError,
  selectOperationBannerVariant,
  selectValidationDisplay,
} from '../selectors/matchReportUiSelectors'
import { playerActionFieldKey } from '../types/matchReportForm.types'
import { normalizeOperationError } from '../utils/errorNormalizer'
import { resolveRecoveryPolicy } from '../utils/recoveryPolicy'
import { emptyMatchReport } from './fixtures'

function loadedState() {
  const report = emptyMatchReport()
  return matchReportReducer(matchReportInitialState, {
    type: 'LOAD_REPORT_SUCCESS',
    payload: { response: { report, cerrada: false, fromActaSnapshot: false } },
  })
}

describe('matchReportUiSelectors', () => {
  it('selectCanEdit refleja editabilidad del acta cargado', () => {
    const state = loadedState()
    expect(selectCanEdit(state)).toBe(true)
  })

  it('selectDirtyFieldKeys detecta cambio en acción E', () => {
    let state = loadedState()
    const playerId = state.report!.local.players[0]!.playerId
    state = matchReportReducer(state, {
      type: 'UPDATE_ACTIONS',
      payload: { side: 'local', playerId, patch: { E: 1 } },
    })
    const keys = selectDirtyFieldKeys(state)
    expect(keys.has(playerActionFieldKey('local', playerId, 'E'))).toBe(true)
  })

  it('selectOperationBannerVariant en error', () => {
    const operationError = normalizeOperationError('TIMEOUT')
    const { hints } = resolveRecoveryPolicy('error', operationError, true, false)
    const state = {
      ...loadedState(),
      operation: 'error' as const,
      operationError,
      recovery: hints,
    }
    expect(selectOperationBannerVariant(state)).toBe('error')
    expect(selectHasRecoverableError(state)).toBe(true)
  })

  it('selectClassificationRows expone filas por equipo', () => {
    const rows = selectClassificationRows(loadedState())
    expect(rows).toHaveLength(2)
    expect(rows[0]?.equipo).toBe('LOCAL')
    expect(rows[1]?.equipo).toBe('VISITANTE')
  })

  it('selectValidationDisplay marca borrador sin acciones', () => {
    const bundle = selectValidationDisplay(loadedState())
    expect(bundle.draft?.ok).toBe(false)
    expect(bundle.draft?.errors.some((e) => e.code === 'DRAFT_NO_ACTIONS')).toBe(true)
    expect(bundle.scoreCoherence?.ok).toBe(true)
    expect(bundle.hasIssues).toBe(true)
  })
})
