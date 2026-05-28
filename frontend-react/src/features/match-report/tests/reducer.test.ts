import { describe, expect, it } from 'vitest'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import { recalculateMatchReport } from '../domain/scoring'
import { normalizeOperationError } from '../utils/errorNormalizer'
import { resolveRecoveryPolicy } from '../utils/recoveryPolicy'
import { baseContext, emptyMatchReport, loadReportResponse, playerLine } from './fixtures'

function opFailure(message: string) {
  const operationError = normalizeOperationError(message)
  const { hints } = resolveRecoveryPolicy('error', operationError, false, false)
  return { error: operationError.userMessage, operationError, recovery: hints }
}

describe('matchReportReducer', () => {
  it('LOAD_REPORT_SUCCESS hidrata y limpia dirty', () => {
    const report = emptyMatchReport()
    const state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    expect(state.report).not.toBeNull()
    expect(state.dirty).toBe(false)
    expect(state.document).not.toBeNull()
    expect(state.operation).toBe('loaded')
  })

  it('UPDATE_ACTIONS recalcula marcador vía dominio', () => {
    const report = emptyMatchReport()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    const playerId = state.report!.local.players[0]!.playerId
    state = matchReportReducer(state, {
      type: 'UPDATE_ACTIONS',
      payload: { side: 'local', playerId, patch: { E: 1 } },
    })
    expect(state.report!.score.local).toBe(5)
    expect(state.dirty).toBe(true)
    expect(state.report!.local.classification.P).toBe(3)
  })

  it('LOCK_REPORT bloquea edición', () => {
    const report = emptyMatchReport()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    state = matchReportReducer(state, { type: 'LOCK_REPORT' })
    expect(state.report!.editability).toBe('read_only')
    expect(state.report!.cerrada).toBe(true)
    expect(state.operation).toBe('locked')
  })

  it('FINALIZE_REPORT_FAILURE no cierra acta', () => {
    const report = emptyMatchReport()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    state = matchReportReducer(state, {
      type: 'FINALIZE_REPORT_FAILURE',
      payload: {
        result: { ok: false, cerrada: false, errorCode: 'COPA_DRAW_NOT_ALLOWED', message: 'Empate' },
      },
    })
    expect(state.report!.cerrada).toBe(false)
    expect(state.error).toBe('Empate')
  })

  it('RESET_REPORT restaura snapshot', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 1 }, { titular: true })],
      },
    })
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    const saved = state.report!
    state = matchReportReducer(state, {
      type: 'UPDATE_ACTIONS',
      payload: {
        side: 'local',
        playerId: saved.local.players[0]!.playerId,
        patch: { E: 5 },
      },
    })
    state = matchReportReducer(state, { type: 'RESET_REPORT' })
    expect(state.report!.score.local).toBe(saved.score.local)
    expect(state.dirty).toBe(false)
  })

  it('SAVE_DRAFT_SUCCESS limpia dirty', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 1 }, { titular: true })],
      },
    })
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    state = { ...state, dirty: true }
    state = matchReportReducer(state, {
      type: 'SAVE_DRAFT_SUCCESS',
      payload: { report },
    })
    expect(state.dirty).toBe(false)
    expect(state.operation).not.toBe('finalizing')
  })

  it('CALCULATE_CLASSIFICATION delega a dominio', () => {
    const report = emptyMatchReport()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    state = matchReportReducer(state, { type: 'CALCULATE_CLASSIFICATION' })
    expect(state.report!.score).toEqual({ local: 0, visitante: 0 })
  })

  it('LOAD_REPORT establece context y operation loading', () => {
    const context = baseContext()
    const state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT',
      payload: { request: { context } },
    })
    expect(state.operation).toBe('loading')
    expect(state.context?.encuentroId).toBe(context.encuentroId)
  })

  it('LOAD_REPORT_FAILURE → operation error', () => {
    const state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_FAILURE',
      payload: opFailure('LINEUPS_NOT_FOUND'),
    })
    expect(state.operation).toBe('error')
    expect(state.operationError?.code).toBe('LINEUPS_NOT_FOUND')
  })

  it('UPDATE_REFEREE y UPDATE_OBSERVATIONS marcan dirty', () => {
    const report = emptyMatchReport()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    state = matchReportReducer(state, {
      type: 'UPDATE_REFEREE',
      payload: { referee: { name: 'Árbitro Test' } },
    })
    expect(state.report!.referee?.name).toBe('Árbitro Test')
    expect(state.dirty).toBe(true)

    state = matchReportReducer(state, {
      type: 'UPDATE_OBSERVATIONS',
      payload: { side: 'local', observaciones: 'Nota local' },
    })
    expect(state.report!.local.observaciones).toBe('Nota local')
    expect(state.dirty).toBe(true)
  })

  it('SAVE_DRAFT_SUCCESS → operation saved', () => {
    const report = emptyMatchReport()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    state = matchReportReducer(state, { type: 'SAVE_DRAFT_SUCCESS', payload: { report } })
    expect(state.operation).toBe('saved')
  })
})
