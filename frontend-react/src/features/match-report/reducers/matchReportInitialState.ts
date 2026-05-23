import type { MatchReportState } from '../types/matchReportState.types'

export const matchReportInitialState: MatchReportState = {
  context: null,
  report: null,
  savedSnapshot: null,
  dirty: false,
  loading: false,
  submitting: false,
  error: null,
  lastValidation: null,
  lastClosure: null,
  operation: 'idle',
  operationError: null,
  recovery: null,
}
