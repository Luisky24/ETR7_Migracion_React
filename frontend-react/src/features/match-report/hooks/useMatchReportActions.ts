import { useCallback, useMemo } from 'react'
import type { MatchScore, PlayerMatchActions, TeamSide } from '../contracts'
import { isServiceSuccess } from '../contracts/service-result.contract'
import type { CopaCloseContext } from '../domain/copa'
import { buildCloseValidationInput } from '../domain'
import { canStartFinalize, canStartSave, isOperationBusy } from '../domain/operationState'
import { runFinalizeDomain } from '../reducers/matchReportReducer'
import { runFinalizeCloseValidators } from '../validators/closeValidators'
import { runDomainValidatorsForDraft } from '../validators/domainValidators'
import { buildMatchPersistenceDto } from '../utils/persistenceDto'
import { normalizeRefereeName } from '../utils/referee'
import {
  closeMatchReportSafe,
  saveMatchReportDraftSafe,
} from '../services/matchReport.service.wrapped'
import { useMatchReportContext } from '../context/useMatchReportContext'
import { buildOperationFailurePayload } from '../utils/operationDispatch'
import { normalizedValidationError } from '../utils/errorNormalizer'
import { resolveRecoveryPolicy } from '../utils/recoveryPolicy'
import { ensurePenaltyTryPlayersOnReport } from '../presentation/penaltyTryPlayer'
import { matchReportRuntimeLog } from '../utils/runtimeLogger'
import { logStagingStale, shouldLogStagingRuntime } from '../tools/stagingRuntimeLogger'
import { logUxOperational } from '../ux/uxOperationalLogger'
import { useMatchReportStateRef } from './useMatchReportStateRef'
import { useOperationInFlight } from './useOperationInFlight'

/** Acciones de edición y persistencia del acta (retry-safe). */
export function useMatchReportActions() {
  const { dispatch } = useMatchReportContext()
  const stateRef = useMatchReportStateRef()
  const inFlight = useOperationInFlight()

  const updateActions = useCallback(
    (side: TeamSide, playerId: string, patch: Partial<PlayerMatchActions>) => {
      if (isOperationBusy(stateRef.current.operation)) return
      dispatch({ type: 'UPDATE_ACTIONS', payload: { side, playerId, patch } })
    },
    [dispatch, stateRef],
  )

  const updateScore = useCallback(
    (score: MatchScore) => {
      if (isOperationBusy(stateRef.current.operation)) return
      dispatch({ type: 'UPDATE_SCORE', payload: { score } })
    },
    [dispatch, stateRef],
  )

  const updateObservations = useCallback(
    (payload: {
      readonly side?: TeamSide
      readonly observaciones?: string
      readonly incidencias?: string
    }) => {
      if (isOperationBusy(stateRef.current.operation)) return
      dispatch({ type: 'UPDATE_OBSERVATIONS', payload })
    },
    [dispatch, stateRef],
  )

  const updateReferee = useCallback(
    (name: string) => {
      if (isOperationBusy(stateRef.current.operation)) return
      dispatch({ type: 'UPDATE_REFEREE', payload: { referee: normalizeRefereeName(name) } })
    },
    [dispatch, stateRef],
  )

  const recalculate = useCallback(() => {
    dispatch({ type: 'CALCULATE_CLASSIFICATION' })
  }, [dispatch])

  const lockReport = useCallback(() => {
    dispatch({ type: 'LOCK_REPORT' })
  }, [dispatch])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET_REPORT' })
  }, [dispatch])

  const saveDraft = useCallback(async () => {
    const state = stateRef.current
    const report = state.report
    if (!report || !canStartSave(state.operation)) return

    if (!inFlight.tryAcquire('save')) {
      dispatch({ type: 'SET_ERROR', payload: { error: inFlight.duplicateError().userMessage } })
      return
    }

    const validation = runDomainValidatorsForDraft(report)
    if (!validation.ok) {
      const err = normalizedValidationError(validation.errors[0]?.message ?? 'Validación fallida.')
      dispatch({ type: 'SET_ERROR', payload: { error: err.userMessage } })
      inFlight.release('save')
      return
    }

    dispatch({ type: 'SAVE_DRAFT' })
    try {
      const dto = buildMatchPersistenceDto(report, false)
      const result = await saveMatchReportDraftSafe(dto, report)
      if (isServiceSuccess(result)) {
        dispatch({
          type: 'SAVE_DRAFT_SUCCESS',
          payload: { report: ensurePenaltyTryPlayersOnReport(result.data.report) },
        })
        matchReportRuntimeLog.operation('save.success', { idEncuentro: dto.idEncuentro })
        return
      }
      const failurePayload = buildOperationFailurePayload(stateRef.current, result.error)
      dispatch({
        type: 'SAVE_DRAFT_FAILURE',
        payload: failurePayload,
      })
      if (failurePayload.operationError?.code === 'DOCUMENT_VERSION_CONFLICT') {
        if (shouldLogStagingRuntime()) {
          logStagingStale({
            matchId: report.context.encuentroId,
            operation: 'save',
            code: failurePayload.operationError.code,
            shouldReload: failurePayload.recovery?.shouldReload,
          })
        }
        logUxOperational('CONCURRENT', 'save.rejected', {
          matchId: report.context.encuentroId,
          preserveDirty: failurePayload.recovery?.preserveDirty,
        })
      }
    } catch (e) {
      const failurePayload = buildOperationFailurePayload(stateRef.current, e)
      dispatch({
        type: 'SAVE_DRAFT_FAILURE',
        payload: failurePayload,
      })
      if (shouldLogStagingRuntime() && failurePayload.operationError?.code === 'DOCUMENT_VERSION_CONFLICT') {
        logStagingStale({
          matchId: report.context.encuentroId,
          operation: 'save',
          code: failurePayload.operationError.code,
        })
      }
    } finally {
      inFlight.release('save')
    }
  }, [dispatch, inFlight, stateRef])

  const finalizeReport = useCallback(
    async (
      copaContext?: CopaCloseContext,
      gasOfficial?: { isCopaGroup: boolean; f2BonusPoints?: number },
      options?: { readonly confirmEmptyClose?: boolean },
    ) => {
      const state = stateRef.current
      const report = state.report
      if (!report || !canStartFinalize(state.operation)) return

      if (!inFlight.tryAcquire('finalize')) {
        dispatch({ type: 'SET_ERROR', payload: { error: inFlight.duplicateError().userMessage } })
        return
      }

      const confirmEmptyClose = options?.confirmEmptyClose ?? false
      const closeValidation = buildCloseValidationInput(report, copaContext, undefined, {
        confirmEmptyClose,
      })
      const validation = runFinalizeCloseValidators(report, copaContext, confirmEmptyClose)
      if (!validation.ok) {
        const err = normalizedValidationError(
          validation.errors[0]?.message ?? 'Validación de cierre fallida.',
        )
        const { hints } = resolveRecoveryPolicy(state.operation, err, true, state.dirty)
        dispatch({
          type: 'FINALIZE_REPORT_FAILURE',
          payload: {
            result: {
              ok: false,
              cerrada: false,
              errorCode: 'VALIDATION_FAILED',
              message: err.userMessage,
            },
            operationError: err,
            recovery: hints,
          },
        })
        inFlight.release('finalize')
        return
      }

      dispatch({ type: 'FINALIZE_REPORT' })

      const domainResult = runFinalizeDomain(state, closeValidation, gasOfficial)
      if (!domainResult || !domainResult.validation.ok) {
        const err = normalizedValidationError(
          domainResult?.closure.message ?? 'No se pudo finalizar.',
        )
        const { hints } = resolveRecoveryPolicy(state.operation, err, true, state.dirty)
        dispatch({
          type: 'FINALIZE_REPORT_FAILURE',
          payload: {
            result: domainResult?.closure ?? {
              ok: false,
              cerrada: false,
              errorCode: 'VALIDATION_FAILED',
              message: err.userMessage,
            },
            operationError: err,
            recovery: hints,
          },
        })
        inFlight.release('finalize')
        return
      }

      try {
        const dto = buildMatchPersistenceDto(domainResult.report, true)
        const closureResult = await closeMatchReportSafe(dto, domainResult.report, {
          gasOfficial,
        })
        if (!isServiceSuccess(closureResult)) {
          const err = closureResult.error
          const { hints } = resolveRecoveryPolicy('finalizing', err, true, state.dirty)
          dispatch({
            type: 'FINALIZE_REPORT_FAILURE',
            payload: {
              result: {
                ok: false,
                cerrada: false,
                errorCode: 'SERVER_ERROR',
                message: err.userMessage,
              },
              operationError: err,
              recovery: hints,
            },
          })
          return
        }
        const closure = closureResult.data
        if (!closure.ok) {
          const err = normalizedValidationError(closure.message ?? 'Cierre rechazado.')
          const { hints } = resolveRecoveryPolicy('finalizing', err, true, state.dirty)
          dispatch({
            type: 'FINALIZE_REPORT_FAILURE',
            payload: {
              result: closure,
              operationError: err,
              recovery: hints,
            },
          })
          return
        }
        dispatch({
          type: 'FINALIZE_REPORT_SUCCESS',
          payload: { result: closure, report: domainResult.report },
        })
        dispatch({ type: 'LOCK_REPORT' })
        matchReportRuntimeLog.operation('finalize.success', { idEncuentro: dto.idEncuentro })
      } catch (e) {
        const payload = buildOperationFailurePayload(stateRef.current, e, {
          failedOperation: 'finalize',
        })
        dispatch({
          type: 'FINALIZE_REPORT_FAILURE',
          payload: {
            result: {
              ok: false,
              cerrada: false,
              errorCode: 'SERVER_ERROR',
              message: payload.error,
            },
            operationError: payload.operationError,
            recovery: payload.recovery,
          },
        })
      } finally {
        inFlight.release('finalize')
      }
    },
    [dispatch, inFlight, stateRef],
  )

  return useMemo(
    () => ({
      updateActions,
      updateScore,
      updateObservations,
      updateReferee,
      recalculate,
      saveDraft,
      finalizeReport,
      lockReport,
      reset,
    }),
    [
      updateActions,
      updateScore,
      updateObservations,
      updateReferee,
      recalculate,
      saveDraft,
      finalizeReport,
      lockReport,
      reset,
    ],
  )
}
