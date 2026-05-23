export {
  CLASSIFICATION_DRAW,
  CLASSIFICATION_LOSS,
  CLASSIFICATION_WIN,
  DEFENSIVE_BONUS_DIFF_EXCLUSIVE_LIMIT,
  DEFENSIVE_BONUS_DIFF_MAX,
  DEFENSIVE_BONUS_DIFF_MIN,
  POINTS_PER_CONVERSION,
  POINTS_PER_PENALTY_KICK,
  POINTS_PER_TRY,
} from './constants'

export {
  ZERO_CLASSIFICATION,
  applyGasOfficialClassification,
  computeClassificationTotal,
  computeClientClassificationPreview,
  qualifiesForDefensiveBonus,
} from './classification'
export type { GasOfficialClassificationInput } from './classification'

export {
  buildCopaPlaceholderLabels,
  extractIdentifFase,
  isCopaCloseApplicable,
  isRankingFinalExcluded,
  validateCopaClose,
  validateCopaConsistencyFase2,
  warnCopaEmpateOnDraft,
} from './copa'
export type { CopaCloseContext } from './copa'

export {
  DEFAULT_CLOSE_POLICY,
  buildCloseValidationInput,
  canOpenMatchReport,
  deriveEditability,
  finalizeMatchReport,
  isReportEditable,
  lockReport,
  needsEmptyCloseConfirmation,
} from './finalization'
export type {
  ClosePolicy,
  FinalizeMatchReportInput,
  FinalizeMatchReportResult,
} from './finalization'

export {
  buildActionSummary,
  computeFullMatchScoring,
  computeMatchScore,
  computeMatchScoreFromTotals,
  computeTeamScoreFromTotals,
  computeTeamScoringBreakdown,
  countActionsInTotals,
  emptyTeamTotals,
  patchPlayerActions,
  recalculateMatchReport,
  resolveMatchResult,
  sumPlayerActions,
} from './scoring'
export type { MatchResult, MatchScoringResult, TeamScoringBreakdown } from './scoring'

export {
  CLOSE_EMPTY_MATCH_WARNING_CODE,
  CLOSE_EMPTY_REQUIRES_CONFIRM_CODE,
  mergeValidationResults,
  validateClose,
  validateFinalizeClose,
  teamActionTotals,
  teamConversionsExceedTries,
  teamConversionsExceedTriesMessage,
  validateConversionsVsTries,
  validateDraftSave,
  validateEditActions,
  validateF2Referencia,
  validateManualScoreUpdate,
  validateScoreCoherence,
  validationFailure,
  validationOk,
  validationWarning,
} from './validation'
export type { CloseValidationInput } from './validation'

export {
  canStartFinalize,
  canStartLoad,
  canStartSave,
  isOperationBusy,
  operationForLoadSuccess,
} from './operationState'
