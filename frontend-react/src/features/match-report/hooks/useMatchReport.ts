import { useMemo } from 'react'
import { useMatchReportContext } from '../context/useMatchReportContext'
import { useMatchReportActions } from './useMatchReportActions'
import { useMatchReportLoad } from './useMatchReportLoad'

/** Orquestación load + acciones (compatibilidad API FASE 1). */
export function useMatchReport() {
  const ctx = useMatchReportContext()
  const { load, reload, dismissError } = useMatchReportLoad()
  const actions = useMatchReportActions()

  return useMemo(
    () => ({
      state: ctx.state,
      dispatch: ctx.dispatch,
      load,
      reload,
      dismissError,
      finalize: actions.finalizeReport,
      ...actions,
    }),
    [ctx.state, ctx.dispatch, load, reload, dismissError, actions],
  )
}
