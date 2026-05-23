import type {
  LoadMatchReportRequest,
  LoadMatchReportResponse,
  MatchClosureResult,
  MatchReferee,
  MatchReport,
  MatchScore,
  PlayerMatchActions,
  TeamSide,
} from '../contracts'
import type { NormalizedOperationError, RecoveryHints } from '../types/matchReportOperation.types'

export interface OperationFailurePayload {
  readonly error: string
  readonly operationError: NormalizedOperationError
  readonly recovery: RecoveryHints
}

export type MatchReportAction =
  | { readonly type: 'LOAD_REPORT'; readonly payload: { readonly request: LoadMatchReportRequest } }
  | { readonly type: 'LOAD_REPORT_SUCCESS'; readonly payload: { readonly response: LoadMatchReportResponse } }
  | { readonly type: 'LOAD_REPORT_FAILURE'; readonly payload: OperationFailurePayload }
  | { readonly type: 'UPDATE_SCORE'; readonly payload: { readonly score: MatchScore } }
  | {
      readonly type: 'UPDATE_ACTIONS'
      readonly payload: {
        readonly side: TeamSide
        readonly playerId: string
        readonly patch: Partial<PlayerMatchActions>
      }
    }
  | {
      readonly type: 'UPDATE_OBSERVATIONS'
      readonly payload: {
        readonly side?: TeamSide
        readonly observaciones?: string
        readonly incidencias?: string
      }
    }
  | { readonly type: 'UPDATE_REFEREE'; readonly payload: { readonly referee?: MatchReferee } }
  | { readonly type: 'CALCULATE_CLASSIFICATION' }
  | { readonly type: 'SAVE_DRAFT' }
  | { readonly type: 'SAVE_DRAFT_SUCCESS'; readonly payload?: { readonly report?: MatchReport } }
  | { readonly type: 'SAVE_DRAFT_FAILURE'; readonly payload: OperationFailurePayload }
  | { readonly type: 'FINALIZE_REPORT' }
  | {
      readonly type: 'FINALIZE_REPORT_SUCCESS'
      readonly payload: { readonly result: MatchClosureResult; readonly report?: MatchReport }
    }
  | {
      readonly type: 'FINALIZE_REPORT_FAILURE'
      readonly payload: {
        readonly result: MatchClosureResult
        readonly operationError?: NormalizedOperationError
        readonly recovery?: RecoveryHints
      }
    }
  | { readonly type: 'LOCK_REPORT' }
  | { readonly type: 'RESET_REPORT' }
  | { readonly type: 'DISMISS_OPERATION_ERROR' }
  | { readonly type: 'SET_ERROR'; readonly payload: { readonly error: string | null } }
  | { readonly type: 'SET_LOADING'; readonly payload: { readonly loading: boolean } }
