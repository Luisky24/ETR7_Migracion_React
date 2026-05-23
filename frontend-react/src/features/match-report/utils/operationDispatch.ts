import type { OperationFailurePayload } from '../reducers/matchReportActions'
import type { MatchReportState } from '../types/matchReportState.types'
import { normalizeOperationError } from './errorNormalizer'
import { resolveRecoveryPolicy, type ResolveRecoveryPolicyOptions } from './recoveryPolicy'

export function buildOperationFailurePayload(
  state: MatchReportState,
  error: unknown,
  recoveryOptions?: ResolveRecoveryPolicyOptions,
): OperationFailurePayload {
  const operationError = normalizeOperationError(error)
  const { hints } = resolveRecoveryPolicy(
    state.operation,
    operationError,
    !!state.report,
    state.dirty,
    recoveryOptions,
  )
  return {
    error: operationError.userMessage,
    operationError,
    recovery: hints,
  }
}
