import type { MatchReport } from '../contracts'
import type { MatchReportOperationStatus } from '../types/matchReportOperation.types'

/** Transiciones puras de operación — sin I/O. */
export function operationForLoadStart(): MatchReportOperationStatus {
  return 'loading'
}

export function operationForLoadSuccess(report: MatchReport, cerrada: boolean): MatchReportOperationStatus {
  if (cerrada || report.cerrada || report.editability === 'read_only') {
    return 'locked'
  }
  return 'loaded'
}

export function operationForLoadFailure(): MatchReportOperationStatus {
  return 'error'
}

export function operationForSaveStart(): MatchReportOperationStatus {
  return 'saving'
}

export function operationForSaveSuccess(cerrada: boolean): MatchReportOperationStatus {
  return cerrada ? 'locked' : 'saved'
}

export function operationForSaveFailure(hasReport: boolean): MatchReportOperationStatus {
  return hasReport ? 'loaded' : 'error'
}

export function operationForFinalizeStart(): MatchReportOperationStatus {
  return 'finalizing'
}

export function operationForFinalizeSuccess(): MatchReportOperationStatus {
  return 'finalized'
}

export function operationForFinalizeFailure(hasReport: boolean): MatchReportOperationStatus {
  return hasReport ? 'loaded' : 'error'
}

export function operationForLock(): MatchReportOperationStatus {
  return 'locked'
}

export function operationForEdit(current: MatchReportOperationStatus): MatchReportOperationStatus {
  if (current === 'locked' || current === 'finalized') return current
  if (current === 'saved' || current === 'error') return 'loaded'
  return current === 'idle' ? 'idle' : 'loaded'
}

export function operationForReset(hasReport: boolean): MatchReportOperationStatus {
  return hasReport ? 'loaded' : 'idle'
}

export function isOperationBusy(operation: MatchReportOperationStatus): boolean {
  return operation === 'loading' || operation === 'saving' || operation === 'finalizing'
}

export function canStartSave(operation: MatchReportOperationStatus): boolean {
  return operation === 'loaded' || operation === 'saved' || operation === 'error'
}

export function canStartFinalize(operation: MatchReportOperationStatus): boolean {
  return operation === 'loaded' || operation === 'saved'
}

export function canStartLoad(operation: MatchReportOperationStatus): boolean {
  return operation === 'idle' || operation === 'error' || operation === 'loaded' || operation === 'saved'
}
