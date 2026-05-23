import type {
  LoadMatchReportRequest,
  LoadMatchReportResponse,
  MatchClosureResult,
  MatchPersistenceDTO,
  MatchReport,
} from '../contracts'
import type { ServiceResult } from '../contracts/service-result.contract'
import {
  isServiceSuccess,
  serviceFatalError,
  serviceRecoverableError,
  serviceSuccess,
  serviceValidationError,
} from '../contracts/service-result.contract'
import { isValidMatchContext, isValidMatchReportWire, isValidPersistenceResponse } from '../guards'
import { normalizeOperationError, normalizedWireError } from '../utils/errorNormalizer'
import { matchReportRuntimeLog } from '../utils/runtimeLogger'
import { executeWithRetry } from '../utils/retryOperation'
import { loadMatchReport as loadRaw } from './matchReport.service'
import {
  closeMatchReportForRuntimeSafe,
  saveMatchReportDraftForRuntimeSafe,
} from './matchReportSave.service'

export async function loadMatchReportSafe(
  request: LoadMatchReportRequest,
): Promise<ServiceResult<LoadMatchReportResponse>> {
  if (!isValidMatchContext(request.context)) {
    return serviceValidationError(
      normalizeOperationError('Contexto de acta inválido', { code: 'VALIDATION_FAILED' }),
    )
  }

  try {
    const data = await executeWithRetry(() => loadRaw(request), 'loadMatchReport')
    return serviceSuccess(data)
  } catch (e) {
    matchReportRuntimeLog.error('load', { message: e instanceof Error ? e.message : String(e) })
    const err = normalizeOperationError(e)
    return err.recoverable ? serviceRecoverableError(err) : serviceFatalError(err)
  }
}

export async function saveMatchReportDraftSafe(
  dto: MatchPersistenceDTO,
  report: MatchReport,
): Promise<ServiceResult<{ readonly ok: true; readonly report: MatchReport }>> {
  return saveMatchReportDraftForRuntimeSafe(dto, report)
}

export async function closeMatchReportSafe(
  dto: MatchPersistenceDTO,
  report: MatchReport,
  options?: { readonly gasOfficial?: { readonly isCopaGroup: boolean; readonly f2BonusPoints?: number } },
): Promise<ServiceResult<MatchClosureResult>> {
  return closeMatchReportForRuntimeSafe(dto, report, {}, options)
}

/** Valida wire crudo antes de adapter (uso en capa GAS). */
export function assertValidLoadWire(raw: unknown): void {
  if (!isValidMatchReportWire(raw)) {
    throw new Error(normalizedWireError('WIRE_INCOMPLETE').technicalMessage)
  }
}

export function assertValidPersistenceWire(raw: unknown): void {
  if (!isValidPersistenceResponse(raw)) {
    throw new Error(normalizedWireError('WIRE_INVALID').technicalMessage)
  }
}

export { isServiceSuccess }
