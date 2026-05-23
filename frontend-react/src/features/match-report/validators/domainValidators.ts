import type { MatchReport } from '../contracts'
import { validateDraftSave, validateEditActions, validateF2Referencia, validateScoreCoherence } from '../domain'
import { mergeValidationResults } from '../domain/validation'

export function runDomainValidatorsForDraft(report: MatchReport) {
  return validateDraftSave(report)
}

export function runDomainValidatorsForEdit(report: MatchReport) {
  return mergeValidationResults(
    validateEditActions(report),
    validateF2Referencia(report.context),
    validateScoreCoherence(report),
  )
}
