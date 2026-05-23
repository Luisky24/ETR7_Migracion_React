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

export interface MatchReportState {
  readonly context: MatchContext | null
  readonly report: MatchReport | null
  readonly savedSnapshot: MatchReport | null
  readonly dirty: boolean
  /** @deprecated Derivar de `operation`; se mantiene por compatibilidad. */
  readonly loading: boolean
  /** @deprecated Derivar de `operation`; se mantiene por compatibilidad. */
  readonly submitting: boolean
  readonly error: string | null
  readonly lastValidation: MatchValidationResult | null
  readonly lastClosure: MatchClosureResult | null
  readonly operation: MatchReportOperationStatus
  readonly operationError: NormalizedOperationError | null
  readonly recovery: RecoveryHints | null
}

export type { LoadMatchReportRequest, LoadMatchReportResponse, MatchClosureResult }
