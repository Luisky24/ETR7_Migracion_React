/**
 * Carga runtime del acta desde Encounter Workspace (único origen documental).
 */

import { log } from '@/core/debug'
import type { EncounterWorkspaceLoadPort } from '../contracts/encounterWorkspaceLoad.contract'
import type { LoadMatchReportRequest, LoadMatchReportResponse } from '../contracts'
import type { ServiceResult } from '../contracts/service-result.contract'
import {
  isServiceSuccess,
  serviceFatalError,
  serviceRecoverableError,
  serviceSuccess,
} from '../contracts/service-result.contract'
import { getActaPersistenceMode } from '../config/persistenceFlags'
import { createEncounterWorkspaceLoadAdapter } from '../infra/encounterWorkspaceLoad.adapter'
import { EncounterWorkspaceLoadError } from '../infra/encounterWorkspaceLoad.errors'
import { normalizeWorkspaceLoadError } from '../utils/bootstrapLoadErrors'
import { executeWithRetry } from '../utils/retryOperation'
import { matchReportRuntimeLog } from '../utils/runtimeLogger'
import { syncActaPersistenceSessionFromWorkspaceLoad } from './actaPersistenceSession'
import type { EncounterWorkspaceLoadResult } from '../contracts/encounterWorkspaceLoad.contract'

const LOAD_LOG = 'matchReportLoad'

export interface MatchReportLoadServiceDeps {
  readonly workspaceLoadPort?: EncounterWorkspaceLoadPort
}

function logLoad(event: string, detail?: Record<string, unknown>): void {
  log.debug(`[${LOAD_LOG}] ${event}`, detail ?? {})
}

export function workspaceLoadResultToLoadResponse(
  result: EncounterWorkspaceLoadResult,
): LoadMatchReportResponse {
  return {
    report: result.report,
    cerrada: result.report.cerrada,
    fromActaSnapshot: result.report.fromActaSnapshot,
  }
}

/** @deprecated Usar workspaceLoadResultToLoadResponse */
export const bootstrapResultToLoadResponse = workspaceLoadResultToLoadResponse

async function loadViaEncounterWorkspace(
  request: LoadMatchReportRequest,
  loadPort: EncounterWorkspaceLoadPort,
): Promise<LoadMatchReportResponse> {
  const loadResult = await loadPort.load({ context: request.context })
  syncActaPersistenceSessionFromWorkspaceLoad(loadResult)
  logLoad('workspaceLoad.ok', {
    source: loadResult.source,
    lifecycle: loadResult.lifecycle,
    workspaceVersion: loadResult.workspaceVersion,
    cerrada: loadResult.report.cerrada,
    encuentroId: request.context.encuentroId,
  })
  return workspaceLoadResultToLoadResponse(loadResult)
}

/**
 * Carga unificada para el hook: siempre hidrata desde Encounter Workspace.
 */
export async function loadMatchReportForRuntimeSafe(
  request: LoadMatchReportRequest,
  deps: MatchReportLoadServiceDeps = {},
): Promise<ServiceResult<LoadMatchReportResponse>> {
  const mode = getActaPersistenceMode()
  logLoad('start', { mode, encuentroId: request.context.encuentroId })

  const loadPort = deps.workspaceLoadPort ?? createEncounterWorkspaceLoadAdapter()

  try {
    const data = await executeWithRetry(
      () => loadViaEncounterWorkspace(request, loadPort),
      'loadMatchReportWorkspace',
    )
    return serviceSuccess(data)
  } catch (e) {
    if (e instanceof EncounterWorkspaceLoadError && e.code === 'CORRUPT_DOCUMENT') {
      logLoad('corruption', { message: e.message, encuentroId: request.context.encuentroId })
      matchReportRuntimeLog.error('load.corrupt', { message: e.message })
    } else if (e instanceof EncounterWorkspaceLoadError) {
      logLoad('workspaceLoad.error', { code: e.code, message: e.message })
      matchReportRuntimeLog.error('load.workspace', { code: e.code, message: e.message })
    } else {
      matchReportRuntimeLog.error('load', { message: e instanceof Error ? e.message : String(e) })
    }

    const normalized = normalizeWorkspaceLoadError(e)
    return normalized.recoverable
      ? serviceRecoverableError(normalized)
      : serviceFatalError(normalized)
  }
}

export { isServiceSuccess }
