import { useMemo } from 'react'
import { useMatchReport } from './useMatchReport'
import {
  selectActaBinding,
  selectAlignmentSnapshots,
  selectDocumentRuntime,
  selectIsSuperseded,
  selectRuntimeReconcileFindings,
  selectRuntimeStaleState,
  selectWorkspaceMetadata,
  selectWorkspaceVersion,
} from '../selectors/matchReportDocumentSelectors'

/**
 * A4.2: Hook oficial documental de Acta (MatchReport).
 * Proyección ligera sobre estado normalizado; sin lifecycle paralelo.
 */
export function useActaDocument() {
  const mr = useMatchReport()
  const { state } = mr

  const document = useMemo(() => selectDocumentRuntime(state), [state])
  const metadata = useMemo(() => selectWorkspaceMetadata(state), [state])
  const stale = useMemo(() => selectRuntimeStaleState(state), [state])
  const superseded = useMemo(() => selectIsSuperseded(state), [state])
  const reconcileFindings = useMemo(() => selectRuntimeReconcileFindings(state), [state])
  const alignmentSnapshots = useMemo(() => selectAlignmentSnapshots(state), [state])

  return useMemo(
    () => ({
      state,
      report: state.report,
      context: state.context,
      document,
      metadata,
      actaBinding: selectActaBinding(state),
      workspaceVersion: selectWorkspaceVersion(state),
      stale,
      superseded,
      reconcileFindings,
      alignmentSnapshots,
      operation: state.operation,
      operationError: state.operationError,
      recovery: state.recovery,
      load: mr.load,
      reload: mr.reload,
      dismissError: mr.dismissError,
      saveDraft: mr.saveDraft,
      close: mr.finalizeReport,
      reset: mr.reset,
      recalculate: mr.recalculate,
    }),
    [mr, state, document, metadata, stale, superseded, reconcileFindings, alignmentSnapshots],
  )
}
