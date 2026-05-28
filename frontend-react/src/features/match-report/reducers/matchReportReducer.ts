import type { MatchReport, TeamSide } from '../contracts'
import {
  DEFAULT_CLOSE_POLICY,
  finalizeMatchReport,
  lockReport,
  patchPlayerActions,
  recalculateMatchReport,
  validateManualScoreUpdate,
} from '../domain'
import {
  operationForEdit,
  operationForFinalizeFailure,
  operationForFinalizeStart,
  operationForFinalizeSuccess,
  operationForLoadFailure,
  operationForLoadStart,
  operationForLoadSuccess,
  operationForLock,
  operationForReset,
  operationForSaveFailure,
  operationForSaveStart,
  operationForSaveSuccess,
} from '../domain/operationState'
import type { MatchReportState } from '../types/matchReportState.types'
import type { MatchReportOperationStatus } from '../types/matchReportOperation.types'
import { reportsEqual } from '../utils/shallowCompare'
import type { MatchReportAction } from './matchReportActions'
import { matchReportInitialState } from './matchReportInitialState'

function patchTeamSide(report: MatchReport, side: TeamSide, patch: Partial<MatchReport['local']>): MatchReport {
  if (side === 'local') {
    return { ...report, local: { ...report.local, ...patch } }
  }
  return { ...report, visitante: { ...report.visitante, ...patch } }
}

function markDirty(state: MatchReportState, report: MatchReport): MatchReportState {
  const dirty = !reportsEqual(report, state.savedSnapshot)
  const operation = operationForEdit(state.operation)
  return applyOperation({ ...state, report, dirty }, operation)
}

function applyOperation(
  state: MatchReportState,
  operation: MatchReportOperationStatus,
  extra: Partial<MatchReportState> = {},
): MatchReportState {
  return {
    ...state,
    operation,
    ...extra,
  }
}

function failureState(
  state: MatchReportState,
  operation: MatchReportOperationStatus,
  payload: { readonly error: string; readonly operationError: MatchReportState['operationError']; readonly recovery: MatchReportState['recovery'] },
): MatchReportState {
  return applyOperation(state, operation, {
    error: payload.error,
    operationError: payload.operationError,
    recovery: payload.recovery,
  })
}

export function matchReportReducer(
  state: MatchReportState = matchReportInitialState,
  action: MatchReportAction,
): MatchReportState {
  switch (action.type) {
    case 'LOAD_REPORT':
      return applyOperation(
        { ...state, error: null, operationError: null, recovery: null, context: action.payload.request.context },
        operationForLoadStart(),
      )

    case 'LOAD_REPORT_SUCCESS': {
      const { report, cerrada } = action.payload.response
      const locked =
        report.cerrada || report.editability === 'read_only' ? lockReport(report).report : report
      const operation = operationForLoadSuccess(locked, cerrada)
      return applyOperation(
        {
          ...state,
          report: locked,
          savedSnapshot: locked,
          document: action.payload.response.document,
          dirty: false,
          error: null,
          operationError: null,
          recovery: null,
          lastValidation: null,
          lastClosure: null,
        },
        operation,
      )
    }

    case 'LOAD_REPORT_FAILURE':
      return failureState(state, operationForLoadFailure(), action.payload)

    case 'UPDATE_SCORE': {
      if (!state.report) return state
      const validation = validateManualScoreUpdate(
        state.report,
        action.payload.score,
        DEFAULT_CLOSE_POLICY.allowManualScoreOverride,
      )
      if (!validation.ok) {
        return { ...state, lastValidation: validation, error: validation.errors[0]?.message ?? null }
      }
      const recalculated = recalculateMatchReport(state.report, {
        scoreOverride: action.payload.score,
      })
      return markDirty(state, recalculated)
    }

    case 'UPDATE_ACTIONS': {
      if (!state.report) return state
      const { side, playerId, patch } = action.payload
      const team = side === 'local' ? state.report.local : state.report.visitante
      const players = patchPlayerActions(team.players, playerId, patch)
      const withPlayers = patchTeamSide(state.report, side, { players })
      const recalculated = recalculateMatchReport(withPlayers)
      return markDirty({ ...state, lastValidation: null }, recalculated)
    }

    case 'UPDATE_OBSERVATIONS': {
      if (!state.report) return state
      let report = state.report
      const { side, observaciones, incidencias } = action.payload
      if (side && observaciones !== undefined) {
        report = patchTeamSide(report, side, { observaciones })
      }
      if (incidencias !== undefined) {
        report = { ...report, incidencias }
      }
      return markDirty(state, report)
    }

    case 'UPDATE_REFEREE': {
      if (!state.report) return state
      const report = { ...state.report, referee: action.payload.referee }
      return markDirty(state, report)
    }

    case 'CALCULATE_CLASSIFICATION': {
      if (!state.report) return state
      return applyOperation(
        { ...state, report: recalculateMatchReport(state.report) },
        operationForEdit(state.operation),
      )
    }

    case 'SAVE_DRAFT':
      return applyOperation({ ...state, error: null, operationError: null, recovery: null }, operationForSaveStart())

    case 'SAVE_DRAFT_SUCCESS': {
      const report = action.payload?.report ?? state.report
      if (!report) {
        return applyOperation(state, operationForSaveFailure(false))
      }
      const cerrada = report.cerrada
      return applyOperation(
        {
          ...state,
          report,
          savedSnapshot: report,
          dirty: false,
          error: null,
          operationError: null,
          recovery: null,
        },
        operationForSaveSuccess(cerrada),
      )
    }

    case 'SAVE_DRAFT_FAILURE':
      return failureState(state, operationForSaveFailure(!!state.report), action.payload)

    case 'FINALIZE_REPORT':
      return applyOperation({ ...state, error: null, operationError: null, recovery: null }, operationForFinalizeStart())

    case 'FINALIZE_REPORT_SUCCESS': {
      const { result, report: payloadReport } = action.payload
      const report = payloadReport ?? (state.report ? lockReport(state.report).report : null)
      return applyOperation(
        {
          ...state,
          report,
          savedSnapshot: report,
          dirty: false,
          lastClosure: result,
          error: null,
          operationError: null,
          recovery: null,
        },
        operationForFinalizeSuccess(),
      )
    }

    case 'FINALIZE_REPORT_FAILURE': {
      const msg = action.payload.result.message ?? 'Error al finalizar el acta.'
      const operationError = action.payload.operationError ?? null
      const recovery = action.payload.recovery ?? null
      return applyOperation(
        {
          ...state,
          lastClosure: action.payload.result,
          error: msg,
          operationError,
          recovery,
        },
        operationForFinalizeFailure(!!state.report),
      )
    }

    case 'LOCK_REPORT': {
      if (!state.report) return state
      const locked = lockReport(state.report).report
      return applyOperation(
        {
          ...state,
          report: locked,
          savedSnapshot: locked,
          dirty: false,
          operationError: null,
          recovery: null,
        },
        operationForLock(),
      )
    }

    case 'RESET_REPORT': {
      if (!state.savedSnapshot) return state
      return applyOperation(
        {
          ...state,
          report: state.savedSnapshot,
          dirty: false,
          error: null,
          operationError: null,
          recovery: null,
          lastValidation: null,
        },
        operationForReset(true),
      )
    }

    case 'DISMISS_OPERATION_ERROR':
      return applyOperation(
        { ...state, error: null, operationError: null, recovery: null },
        state.report ? operationForEdit('loaded') : 'idle',
      )

    case 'SET_ERROR':
      return { ...state, error: action.payload.error }

    case 'SET_LOADING':
      return applyOperation(state, action.payload.loading ? 'loading' : state.operation)

    default:
      return state
  }
}

/** Helper para finalizar desde hook (dominio puro, sin I/O). */
export function runFinalizeDomain(
  state: MatchReportState,
  closeValidation: Parameters<typeof finalizeMatchReport>[0]['closeValidation'],
  gasOfficial?: Parameters<typeof finalizeMatchReport>[0]['gasOfficial'],
): ReturnType<typeof finalizeMatchReport> | null {
  if (!state.report) return null
  return finalizeMatchReport({
    report: state.report,
    closeValidation,
    gasOfficial,
  })
}
