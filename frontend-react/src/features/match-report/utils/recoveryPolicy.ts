import type { MatchReportOperationStatus } from '../types/matchReportOperation.types'
import type { NormalizedOperationError, RecoveryHints } from '../types/matchReportOperation.types'

export type RecoveryAction = 'retry' | 'reload' | 'resetDirty' | 'block' | 'none'

export interface RecoveryDecision {
  readonly action: RecoveryAction
  readonly hints: RecoveryHints
}

export interface ResolveRecoveryPolicyOptions {
  /** Operación que falló (p. ej. cierre tras volver a `loaded`). */
  readonly failedOperation?: 'load' | 'save' | 'finalize'
}

function operationAllowsFinalizeRetry(operation: MatchReportOperationStatus): boolean {
  if (operation === 'locked' || operation === 'finalized') return false
  return operation === 'loaded' || operation === 'saved' || operation === 'finalizing'
}

function isFinalizeFailureContext(
  operation: MatchReportOperationStatus,
  options?: ResolveRecoveryPolicyOptions,
): boolean {
  return options?.failedOperation === 'finalize' || operation === 'finalizing'
}

/** Política pura: qué hacer tras un error operacional. */
export function resolveRecoveryPolicy(
  operation: MatchReportOperationStatus,
  error: NormalizedOperationError,
  hasReport: boolean,
  isDirty: boolean,
  options?: ResolveRecoveryPolicyOptions,
): RecoveryDecision {
  if (error.shouldBlock) {
    return {
      action: 'block',
      hints: {
        canRetrySave: false,
        canRetryFinalize: false,
        canReload: false,
        preserveDirty: isDirty,
      },
    }
  }

  const preserveDirty = hasReport && isDirty
  const canRetrySave =
    error.retryable && hasReport && (operation === 'error' || operation === 'loaded' || operation === 'saved')
  const canRetryFinalize =
    error.retryable &&
    error.recoverable &&
    hasReport &&
    isDirty &&
    isFinalizeFailureContext(operation, options) &&
    operationAllowsFinalizeRetry(operation)
  const canReload = error.shouldReload || (error.retryable && !hasReport)

  let action: RecoveryAction = 'none'
  if (canReload) action = 'reload'
  else if (canRetrySave || canRetryFinalize) action = 'retry'
  else if (preserveDirty && hasReport) action = 'resetDirty'

  return {
    action,
    hints: {
      canRetrySave: canRetrySave && !error.shouldBlock,
      canRetryFinalize,
      canReload,
      preserveDirty,
    },
  }
}

/** Tras éxito de guardado: volver a `saved`; tras edición → `loaded`. */
export function operationAfterSuccessfulSave(cerrada: boolean): MatchReportOperationStatus {
  return cerrada ? 'locked' : 'saved'
}

export function operationAfterSuccessfulLoad(cerrada: boolean): MatchReportOperationStatus {
  if (cerrada) return 'locked'
  return 'loaded'
}

export function operationAfterSuccessfulFinalize(): MatchReportOperationStatus {
  return 'finalized'
}

/** Si hay informe en memoria tras error recuperable, mantener `loaded` para reintentar. */
export function operationAfterRecoverableFailure(hasReport: boolean, wasFinalizing: boolean): MatchReportOperationStatus {
  if (!hasReport) return 'error'
  return wasFinalizing ? 'loaded' : 'loaded'
}
