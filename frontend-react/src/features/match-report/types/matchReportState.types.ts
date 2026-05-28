import type {
  LoadMatchReportRequest,
  LoadMatchReportResponse,
  MatchClosureResult,
  MatchContext,
  MatchReport,
  MatchValidationResult,
} from '../contracts'
import type {
  MatchReportOperationStatus,
  NormalizedOperationError,
  RecoveryHints,
} from './matchReportOperation.types'
import type { MatchReportDocumentRuntimeState } from './matchReportDocumentRuntime.types'

export interface MatchReportState {
  readonly context: MatchContext | null
  readonly report: MatchReport | null
  readonly savedSnapshot: MatchReport | null
  /** A4.2: proyección documental normalizada (Workspace + refs + reconcile). */
  readonly document: MatchReportDocumentRuntimeState | null
  readonly dirty: boolean
  readonly error: string | null
  readonly lastValidation: MatchValidationResult | null
  readonly lastClosure: MatchClosureResult | null
  readonly operation: MatchReportOperationStatus
  readonly operationError: NormalizedOperationError | null
  readonly recovery: RecoveryHints | null
}

export type { LoadMatchReportRequest, LoadMatchReportResponse, MatchClosureResult }
