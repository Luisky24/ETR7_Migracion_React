/**
 * A4.3 — Carga documental unificada (único hydrate para Report, Lineups, diagnostics).
 */

import type { MatchContext } from '../contracts'
import type { EncounterWorkspaceLoadPort } from '../contracts/encounterWorkspaceLoad.contract'
import { createEncounterWorkspaceLoadAdapter } from '../infra/encounterWorkspaceLoad.adapter'
import {
  commitDocumentRuntimeLoad,
  getDocumentRuntimeEntry,
  type DocumentRuntimeEntry,
} from '../domain/documentRuntimeStore'
import { syncActaPersistenceSessionFromWorkspaceLoad } from './actaPersistenceSession'
import { observeDocumentRuntimeAfterHydrate } from '../tools/observeDocumentRuntimeStaging'
import { resetStagingRuntimeTraceId } from '../tools/stagingRuntimeLogger'

export interface LoadDocumentRuntimeOptions {
  readonly force?: boolean
  readonly workspaceLoadPort?: EncounterWorkspaceLoadPort
}

/**
 * Hidrata Encounter Workspace una vez y compromete cache/runtime documental oficial.
 */
export async function loadDocumentRuntime(
  context: MatchContext,
  options: LoadDocumentRuntimeOptions = {},
): Promise<DocumentRuntimeEntry> {
  if (!options.force) {
    const cached = getDocumentRuntimeEntry(context.encuentroId)
    if (cached) {
      observeDocumentRuntimeAfterHydrate(cached, { source: 'cache', phase: 'loadDocumentRuntime' })
      return cached
    }
  }

  resetStagingRuntimeTraceId(context.encuentroId)
  const port = options.workspaceLoadPort ?? createEncounterWorkspaceLoadAdapter()
  const loadResult = await port.load({ context })
  syncActaPersistenceSessionFromWorkspaceLoad(loadResult)
  const document = commitDocumentRuntimeLoad(loadResult)
  const entry = {
    matchId: document.matchId,
    document,
    workspace: loadResult.workspace,
    loadResult,
  }
  observeDocumentRuntimeAfterHydrate(entry, { source: 'network', phase: 'loadDocumentRuntime' })
  return entry
}
