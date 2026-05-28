import type { MatchReportState } from '../types/matchReportState.types'

export const matchReportInitialState: MatchReportState = {
  context: null,
  report: null,
  savedSnapshot: null,
  document: null,
  dirty: false,
  error: null,
  lastValidation: null,
  lastClosure: null,
  operation: 'idle',
  operationError: null,
  recovery: null,
}
