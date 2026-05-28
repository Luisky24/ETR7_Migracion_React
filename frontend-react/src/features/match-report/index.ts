/** API pública del feature match-report (FASE 1–2). */
export type {
  LoadMatchReportRequest,
  LoadMatchReportResponse,
  MatchContext,
  MatchReport,
  MatchScore,
  MatchClassification,
  MatchClosureResult,
  MatchValidationResult,
} from './contracts'

export { MatchReportProvider } from './context/MatchReportProvider'
export { useMatchReportContext } from './context/useMatchReportContext'
export { useMatchReport } from './hooks/useMatchReport'
export { useActaDocument } from './hooks/useActaDocument'
export { useMatchReportLoad } from './hooks/useMatchReportLoad'
export { useMatchReportActions } from './hooks/useMatchReportActions'
export { useMatchReportForm } from './hooks/useMatchReportForm'
export { MatchReportPage } from './pages/MatchReportPage'
export { MatchReportView } from './components/MatchReportView'
export { matchContextFromCalendar } from './adapters/calendar.mapper'
export { buildMatchReportSearchParams, matchContextFromSearchParams } from './utils/matchReportQuery'

export {
  computeClientClassificationPreview,
  computeTeamScoreFromTotals,
  recalculateMatchReport,
  validateDraftSave,
  validateClose,
} from './domain'

export {
  selectCanFinalize,
  selectCanSaveDraft,
  selectClassification,
  selectClosureState,
  selectIsEditable,
  selectIsReadOnly,
  selectMatchReport,
  selectMatchResult,
} from './selectors/matchReportSelectors'

export {
  selectCanEdit,
  selectCanFinalizeUi,
  selectClassificationRows,
  selectDirtyFieldKeys,
  selectHasRecoverableError,
  selectOperationBannerVariant,
  selectValidationDisplay,
} from './selectors/matchReportUiSelectors'

export {
  selectCanAttemptFinalize,
  selectCanAttemptSave,
  selectCloseBlockingErrors,
  selectDraftBlockingErrors,
  selectHelpHasActiveNotices,
  selectMatchHelpContent,
  selectShowOperationBanner,
} from './selectors/matchReportValidationUxSelectors'

export {
  selectActaBinding,
  selectAlignmentSnapshots,
  selectDocumentRuntime,
  selectIsSuperseded,
  selectRuntimeReconcileFindings,
  selectRuntimeStaleState,
  selectSupersededState,
  selectWorkspaceMetadata,
  selectWorkspaceVersion,
} from './selectors/matchReportDocumentSelectors'

export {
  selectLineupAlignmentRefs,
  selectLineupIsSuperseded,
  selectLineupSnapshots,
  selectLineupStaleState,
  selectLineupSupersededState,
  selectLineupTeamViews,
} from './selectors/lineupDocumentSelectors'

export { loadDocumentRuntime } from './services/documentRuntimeLoad.service'
export {
  commitDocumentRuntimeLoad,
  clearDocumentRuntimeStore,
  getDocumentRuntimeEntry,
} from './domain/documentRuntimeStore'

export type {
  MatchReportDocumentRuntimeState,
  RuntimeStaleState,
  RuntimeSupersededState,
} from './types/matchReportDocumentRuntime.types'

export {
  getMatchReportServiceMode,
  setMatchReportServiceMode,
} from './services/matchReport.service'

export type { MatchReportServiceMode } from './services/matchReport.service'

export type { ServiceResult, ServiceResultKind } from './contracts/service-result.contract'

export {
  armQaRuntimeFlags,
  isQaRuntimeSimulationEnabled,
  isQaSimulatedError,
  resetQaRuntimeSimulation,
} from './utils/qaRuntimeSimulation'
export type { Etr7QaRuntimeFlags, QaRuntimeOperation } from './utils/qaRuntimeSimulation'
export type { MatchReportOperationStatus, NormalizedOperationError, RecoveryHints } from './types/matchReportOperation.types'
export {
  selectOperation,
  selectOperationLabel,
  selectCanRetrySave,
  selectCanRetryFinalize,
  selectCanReloadReport,
} from './selectors/matchReportOperationSelectors'
