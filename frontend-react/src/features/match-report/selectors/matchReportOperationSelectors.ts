import { isOperationBusy, canStartFinalize, canStartLoad, canStartSave } from '../domain/operationState'
import type { MatchReportState } from '../types/matchReportState.types'
import { buildLoadingUxLabel } from '../ux/uxOperationalMessages'
import { selectIsDocumentallyBlocked } from './matchReportDocumentSelectors'

export function selectOperation(state: MatchReportState) {
  return state.operation
}

export function selectOperationError(state: MatchReportState) {
  return state.operationError
}

export function selectRecoveryHints(state: MatchReportState) {
  return state.recovery
}

export function selectIsOperationBusy(state: MatchReportState): boolean {
  return isOperationBusy(state.operation)
}

export function selectCanRetrySave(state: MatchReportState): boolean {
  return !!state.recovery?.canRetrySave && canStartSave(state.operation)
}

export function selectCanRetryFinalize(state: MatchReportState): boolean {
  return !!state.recovery?.canRetryFinalize && canStartFinalize(state.operation)
}

export function selectCanReloadReport(state: MatchReportState): boolean {
  return !!state.recovery?.canReload && !!state.context
}

export function selectOperationLabel(state: MatchReportState): string {
  if (selectIsDocumentallyBlocked(state) && state.operation === 'loaded') {
    return 'Solo lectura (estado documental)'
  }
  const labels: Record<MatchReportState['operation'], string> = {
    idle: 'En espera',
    loading: buildLoadingUxLabel('loading'),
    loaded: 'Listo para editar',
    saving: buildLoadingUxLabel('saving'),
    saved: 'Borrador guardado',
    finalizing: buildLoadingUxLabel('finalizing'),
    finalized: 'Acta cerrada',
    locked: 'Acta cerrada (solo lectura)',
    error: 'Revisar error',
  }
  return labels[state.operation]
}

export function selectCanSaveDraftOperational(state: MatchReportState): boolean {
  return selectCanRetrySave(state) || (canStartSave(state.operation) && !selectIsDocumentallyBlocked(state))
}

export function selectCanStartLoadOperation(state: MatchReportState): boolean {
  return canStartLoad(state.operation) && !isOperationBusy(state.operation)
}

export function selectUserFacingError(state: MatchReportState): string | null {
  return state.operationError?.userMessage ?? state.error
}
