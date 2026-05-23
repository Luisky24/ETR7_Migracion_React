import { useCallback } from 'react'
import type { MatchContext } from '../contracts'
import { canStartLoad } from '../domain/operationState'
import { useMatchReportContext } from '../context/useMatchReportContext'
import { isServiceSuccess, loadMatchReportForRuntimeSafe } from '../services/matchReportLoad.service'
import { buildOperationFailurePayload } from '../utils/operationDispatch'
import { matchContextLoadKey } from '../utils/matchReportQuery'
import { ensurePenaltyTryPlayersOnReport } from '../presentation/penaltyTryPlayer'
import { matchReportRuntimeLog } from '../utils/runtimeLogger'
import { useMatchReportStateRef } from './useMatchReportStateRef'
import { useOperationInFlight } from './useOperationInFlight'

/** Carga inicial del acta: hydrate reducer + loading/error + reintento. */
export function useMatchReportLoad() {
  const { dispatch } = useMatchReportContext()
  const stateRef = useMatchReportStateRef()
  const inFlight = useOperationInFlight()

  const load = useCallback(
    async (context: MatchContext, options?: { readonly force?: boolean }) => {
      const state = stateRef.current
      if (!options?.force && !canStartLoad(state.operation)) {
        matchReportRuntimeLog.operation('load.skipped', { operation: state.operation })
        return
      }
      if (!inFlight.tryAcquire('load')) {
        dispatch({
          type: 'SET_ERROR',
          payload: { error: inFlight.duplicateError().userMessage },
        })
        return
      }

      dispatch({ type: 'LOAD_REPORT', payload: { request: { context } } })
      try {
        const result = await loadMatchReportForRuntimeSafe({ context })
        if (isServiceSuccess(result)) {
          const response = {
            ...result.data,
            report: ensurePenaltyTryPlayersOnReport(result.data.report),
          }
          dispatch({ type: 'LOAD_REPORT_SUCCESS', payload: { response } })
          if (result.data.cerrada) {
            dispatch({ type: 'LOCK_REPORT' })
          }
          matchReportRuntimeLog.operation('load.success', {
            encuentroId: context.encuentroId,
            loadKey: matchContextLoadKey(context),
          })
          return
        }
        const err = result.error
        dispatch({
          type: 'LOAD_REPORT_FAILURE',
          payload: buildOperationFailurePayload(stateRef.current, err),
        })
      } catch (e) {
        dispatch({
          type: 'LOAD_REPORT_FAILURE',
          payload: buildOperationFailurePayload(stateRef.current, e),
        })
      } finally {
        inFlight.release('load')
      }
    },
    [dispatch, inFlight, stateRef],
  )

  const reload = useCallback(async () => {
    const ctx = stateRef.current.context
    if (!ctx) return
    await load(ctx, { force: true })
  }, [load, stateRef])

  const dismissError = useCallback(() => {
    dispatch({ type: 'DISMISS_OPERATION_ERROR' })
  }, [dispatch])

  return { load, reload, dismissError }
}
