import type { MatchReportOperationStatus } from '../types/matchReportOperation.types'

/** Deriva flags legacy `loading` / `submitting` desde operación (compat selectores). */
export function syncLegacyFlags(operation: MatchReportOperationStatus): {
  readonly loading: boolean
  readonly submitting: boolean
} {
  return {
    loading: operation === 'loading',
    submitting: operation === 'saving' || operation === 'finalizing',
  }
}
