/**
 * Save/Close runtime: legacy Sheets o persistencia JSON oficial según feature flag.
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
  getActaPersistenceMode,
  usesJsonPersistence,
  type ActaPersistenceMode,
} from '../config/persistenceFlags'
import { normalizeOperationError } from '../utils/errorNormalizer'
import { executeWithRetry } from '../utils/retryOperation'
import { matchReportRuntimeLog } from '../utils/runtimeLogger'
import { log } from '@/core/debug'
import {
  closeMatchReport as closeRaw,
  saveMatchReportDraft as saveRaw,
} from './matchReport.service'
import { closeActaJson, saveActaDraftJson, type ActaPersistenceServiceDeps } from './actaPersistence.service'

const SAVE_LOG = 'matchReportSave'

export interface MatchReportSaveServiceDeps extends ActaPersistenceServiceDeps {
  readonly getPersistenceMode?: () => ActaPersistenceMode
  readonly saveLegacy?: (
    dto: MatchPersistenceDTO,
    report: MatchReport,
  ) => Promise<{ readonly ok: true; readonly report: MatchReport }>
  readonly closeLegacy?: (dto: MatchPersistenceDTO, report: MatchReport) => Promise<MatchClosureResult>
}

function logSave(event: string, detail?: Record<string, unknown>): void {
  log.debug(`[${SAVE_LOG}] ${event}`, detail ?? {})
}

async function saveLegacyInternal(
  dto: MatchPersistenceDTO,
  report: MatchReport,
  deps: MatchReportSaveServiceDeps,
): Promise<ServiceResult<{ readonly ok: true; readonly report: MatchReport }>> {
  logSave('path.legacy', { idEncuentro: dto.idEncuentro })
  try {
    const data = await executeWithRetry(
      () => (deps.saveLegacy ?? saveRaw)(dto, report),
      'saveDraft',
    )
    return serviceSuccess(data)
  } catch (e) {
    matchReportRuntimeLog.error('saveDraft', { message: e instanceof Error ? e.message : String(e) })
    const err = normalizeOperationError(e)
    return err.recoverable ? serviceRecoverableError(err) : serviceFatalError(err)
  }
}

async function closeLegacyInternal(
  dto: MatchPersistenceDTO,
  report: MatchReport,
  deps: MatchReportSaveServiceDeps,
): Promise<ServiceResult<MatchClosureResult>> {
  logSave('close.path.legacy', { idEncuentro: dto.idEncuentro })
  try {
    const data = await executeWithRetry(
      () => (deps.closeLegacy ?? closeRaw)(dto, report),
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

export async function saveMatchReportDraftForRuntimeSafe(
  dto: MatchPersistenceDTO,
  report: MatchReport,
  deps: MatchReportSaveServiceDeps = {},
): Promise<ServiceResult<{ readonly ok: true; readonly report: MatchReport }>> {
  const mode = deps.getPersistenceMode?.() ?? getActaPersistenceMode()
  logSave('draft.start', { mode, idEncuentro: dto.idEncuentro })

  if (!usesJsonPersistence(mode)) {
    return saveLegacyInternal(dto, report, deps)
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
  const mode = deps.getPersistenceMode?.() ?? getActaPersistenceMode()
  logSave('close.start', { mode, idEncuentro: dto.idEncuentro })

  if (!usesJsonPersistence(mode)) {
    return closeLegacyInternal(dto, report, deps)
  }

  logSave('close.path.json', { mode })
  return closeActaJson(report, deps, { gasOfficial: options.gasOfficial })
}

export { isServiceSuccess }
