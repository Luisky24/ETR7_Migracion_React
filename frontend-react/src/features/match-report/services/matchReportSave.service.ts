/**
 * Save/Close runtime: persistencia JSON oficial (Encounter Workspace / Actas JSON).
 * A4: runtime React no puede escribir a Sheets (sin fallback legacy).
 */

import type { MatchClosureResult, MatchPersistenceDTO, MatchReport } from '../contracts'
import type { ServiceResult } from '../contracts/service-result.contract'
import {
  isServiceSuccess,
  serviceFatalError,
  serviceRecoverableError,
  serviceSuccess,
} from '../contracts/service-result.contract'
import {
  type ActaPersistenceMode,
} from '../config/persistenceFlags'
import { normalizeOperationError } from '../utils/errorNormalizer'
import { executeWithRetry } from '../utils/retryOperation'
import { matchReportRuntimeLog } from '../utils/runtimeLogger'
import { log } from '@/core/debug'
import { closeActaJson, saveActaDraftJson, type ActaPersistenceServiceDeps } from './actaPersistence.service'
import { closeMatchReport as closeMockOrGas, getMatchReportServiceMode, saveMatchReportDraft as saveMockOrGas } from './matchReport.service'

const SAVE_LOG = 'matchReportSave'

export interface MatchReportSaveServiceDeps extends ActaPersistenceServiceDeps {
  readonly getPersistenceMode?: () => ActaPersistenceMode
}

function logSave(event: string, detail?: Record<string, unknown>): void {
  log.debug(`[${SAVE_LOG}] ${event}`, detail ?? {})
}

export async function saveMatchReportDraftForRuntimeSafe(
  dto: MatchPersistenceDTO,
  report: MatchReport,
  deps: MatchReportSaveServiceDeps = {},
): Promise<ServiceResult<{ readonly ok: true; readonly report: MatchReport }>> {
  const mode = deps.getPersistenceMode?.() ?? 'json'
  logSave('draft.start', { mode, idEncuentro: dto.idEncuentro })

  // Soporte test/local-dev: servicio `mock` (no Sheets, sin GAS).
  if (getMatchReportServiceMode() === 'mock') {
    try {
      const data = await executeWithRetry(() => saveMockOrGas(dto, report), 'saveDraft')
      return serviceSuccess(data)
    } catch (e) {
      matchReportRuntimeLog.error('saveDraft', { message: e instanceof Error ? e.message : String(e) })
      const err = normalizeOperationError(e)
      return err.recoverable ? serviceRecoverableError(err) : serviceFatalError(err)
    }
  }

  logSave('draft.path.json', { mode })
  return saveActaDraftJson(report, deps)
}

export interface CloseMatchReportForRuntimeOptions {
  readonly gasOfficial?: { readonly isCopaGroup: boolean; readonly f2BonusPoints?: number }
}

export async function closeMatchReportForRuntimeSafe(
  dto: MatchPersistenceDTO,
  report: MatchReport,
  deps: MatchReportSaveServiceDeps = {},
  options: CloseMatchReportForRuntimeOptions = {},
): Promise<ServiceResult<MatchClosureResult>> {
  const mode = deps.getPersistenceMode?.() ?? 'json'
  logSave('close.start', { mode, idEncuentro: dto.idEncuentro })

  if (getMatchReportServiceMode() === 'mock') {
    try {
      const data = await executeWithRetry(
        () => closeMockOrGas(dto, report),
        'closeMatchReport',
        { maxAttempts: 1 },
      )
      if (!data.ok) {
        const err = normalizeOperationError(data.message ?? 'Cierre rechazado', {
          code: data.errorCode ?? 'SERVER_ERROR',
        })
        return err.recoverable ? serviceRecoverableError(err) : serviceFatalError(err)
      }
      return serviceSuccess(data)
    } catch (e) {
      matchReportRuntimeLog.error('close', { message: e instanceof Error ? e.message : String(e) })
      const err = normalizeOperationError(e)
      return err.recoverable ? serviceRecoverableError(err) : serviceFatalError(err)
    }
  }

  logSave('close.path.json', { mode })
  return closeActaJson(report, deps, { gasOfficial: options.gasOfficial })
}

export { isServiceSuccess }
