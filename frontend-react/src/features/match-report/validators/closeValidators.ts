import type { MatchReport } from '../contracts'
import {
  buildCloseValidationInput,
  DEFAULT_CLOSE_POLICY,
  validateClose,
  validateFinalizeClose,
} from '../domain'
import type { CopaCloseContext } from '../domain/copa'

export function runCloseValidators(report: MatchReport, copaContext?: CopaCloseContext) {
  return validateClose(buildCloseValidationInput(report, copaContext, DEFAULT_CLOSE_POLICY))
}

export function runFinalizeCloseValidators(
  report: MatchReport,
  copaContext?: CopaCloseContext,
  confirmEmptyClose = false,
) {
  return validateFinalizeClose(
    buildCloseValidationInput(report, copaContext, DEFAULT_CLOSE_POLICY, { confirmEmptyClose }),
  )
}
