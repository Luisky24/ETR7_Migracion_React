import type { MatchClassification, MatchReport, TeamSide } from '../contracts'
import {
  buildActionSummary,
  buildCloseValidationInput,
  DEFAULT_CLOSE_POLICY,
  isReportEditable,
  resolveMatchResult,
  validateClose,
  validateDraftSave,
} from '../domain'
import type { CopaCloseContext } from '../domain/copa'
import type { MatchReportState } from '../types/matchReportState.types'
import { isOperationBusy } from '../domain/operationState'

export function selectMatchReport(state: MatchReportState): MatchReport | null {
  return state.report
}

export function selectIsDirty(state: MatchReportState): boolean {
  return state.dirty
}

export function selectIsEditable(state: MatchReportState): boolean {
  return isReportEditable(state.report)
}

export function selectIsReadOnly(state: MatchReportState): boolean {
  const report = state.report
  if (!report) return true
  return report.editability === 'read_only' || report.cerrada
}

export function selectIsBlocked(state: MatchReportState): boolean {
  return state.report?.editability === 'blocked'
}

export function selectClosureState(state: MatchReportState): 'open' | 'closed' | 'idle' {
  if (!state.report) return 'idle'
  return state.report.cerrada ? 'closed' : 'open'
}

export function selectMatchScore(state: MatchReportState) {
  return state.report?.score ?? null
}

export function selectMatchResult(state: MatchReportState) {
  const score = selectMatchScore(state)
  if (!score) return null
  return resolveMatchResult(score)
}

export function selectActionSummary(state: MatchReportState) {
  const report = state.report
  if (!report) return null
  return buildActionSummary(report.local.players, report.visitante.players)
}

export function selectClassification(
  state: MatchReportState,
  side: TeamSide,
): MatchClassification | null {
  const report = state.report
  if (!report) return null
  return side === 'local' ? report.local.classification : report.visitante.classification
}

export function selectCanSaveDraft(state: MatchReportState): boolean {
  if (!selectIsEditable(state) || !state.dirty || isOperationBusy(state.operation)) return false
  const report = state.report
  if (!report) return false
  return validateDraftSave(report).ok
}

export function selectCanFinalize(
  state: MatchReportState,
  copaContext?: CopaCloseContext,
): boolean {
  if (!selectIsEditable(state) || isOperationBusy(state.operation)) return false
  const report = state.report
  if (!report) return false
  const validation = validateClose(
    buildCloseValidationInput(report, copaContext, DEFAULT_CLOSE_POLICY),
  )
  return validation.ok
}

export function selectLastValidation(state: MatchReportState) {
  return state.lastValidation
}

export function selectLastClosure(state: MatchReportState) {
  return state.lastClosure
}

export function selectIsLoading(state: MatchReportState): boolean {
  return state.operation === 'loading'
}

export function selectIsSubmitting(state: MatchReportState): boolean {
  return state.operation === 'saving' || state.operation === 'finalizing'
}

export function selectError(state: MatchReportState): string | null {
  return state.operationError?.userMessage ?? state.error
}
