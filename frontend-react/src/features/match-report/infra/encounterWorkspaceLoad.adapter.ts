/**
 * Carga operacional Encounter Workspace → MatchReport (sin legacy Sheets).
 */

import type {
  EncounterWorkspaceLoadPort,
  EncounterWorkspaceLoadRequest,
  EncounterWorkspaceLoadResult,
  EncounterWorkspaceLoadSource,
} from '../contracts/encounterWorkspaceLoad.contract'
import { EncounterWorkspaceRepository } from '../persistence/encounterWorkspace.repository'
import { matchKeyFromContext } from '../persistence/matchKey'
import { createJsonPersistenceRepository } from './jsonPersistence.adapter'
import type { JsonPersistenceRepositoryOptions } from './jsonPersistence.adapter'
import { FakeDriveEncounterWorkspaceStore } from './fakeDriveEncounterWorkspaceStore'
import { DriveGasEncounterWorkspaceStore } from './driveGasEncounterWorkspaceStore'
import {
  actaProjectionFromWorkspace,
  hydrateMatchReportFromWorkspace,
  resolveLifecycleFromWorkspace,
  shouldUseActaSectionForHydration,
} from '../adapters/workspaceHydration.adapter'
import { ActaPersistenceError } from '../persistence/actaPersistenceError'
import { shouldHydrateActaFromWorkspace } from '../utils/encounterWorkflow'
import {
  EncounterWorkspaceLoadError,
  workspaceLoadErrorFromPersistence,
} from './encounterWorkspaceLoad.errors'

export interface EncounterWorkspaceLoadLogger {
  debug(event: string, data?: Record<string, unknown>): void
  warn(event: string, data?: Record<string, unknown>): void
  error(event: string, data?: Record<string, unknown>): void
}

export interface EncounterWorkspaceLoadAdapterOptions {
  readonly workspaceRepository?: EncounterWorkspaceRepository
  readonly repositoryOptions?: JsonPersistenceRepositoryOptions
  readonly createdBy?: string
  readonly log?: EncounterWorkspaceLoadLogger
}

export function createEncounterWorkspaceLoadAdapter(
  options: EncounterWorkspaceLoadAdapterOptions = {},
): EncounterWorkspaceLoadPort {
  return new EncounterWorkspaceLoadAdapter(options)
}

/** @deprecated Usar createEncounterWorkspaceLoadAdapter */
export const createActaBootstrapAdapter = createEncounterWorkspaceLoadAdapter

export type ActaBootstrapAdapterOptions = EncounterWorkspaceLoadAdapterOptions

class EncounterWorkspaceLoadAdapter implements EncounterWorkspaceLoadPort {
  private readonly workspaceRepo: EncounterWorkspaceRepository
  private readonly createdBy: string
  private readonly log: EncounterWorkspaceLoadLogger

  constructor(options: EncounterWorkspaceLoadAdapterOptions) {
    if (options.workspaceRepository) {
      this.workspaceRepo = options.workspaceRepository
    } else if (options.repositoryOptions?.workspaceStore) {
      this.workspaceRepo = new EncounterWorkspaceRepository(
        options.repositoryOptions.workspaceStore,
        options.log,
      )
    } else {
      const jsonRepo = createJsonPersistenceRepository(options.repositoryOptions)
      const store =
        'driveStore' in jsonRepo
          ? (jsonRepo as { driveStore: FakeDriveEncounterWorkspaceStore }).driveStore
          : new DriveGasEncounterWorkspaceStore()
      this.workspaceRepo = new EncounterWorkspaceRepository(store, options.log)
    }
    this.createdBy = options.createdBy ?? 'etr7-runtime'
    this.log = options.log ?? defaultLoadLogger()
  }

  async load(request: EncounterWorkspaceLoadRequest): Promise<EncounterWorkspaceLoadResult> {
    return this.loadInternal(request)
  }

  /** @deprecated Usar load */
  async bootstrap(request: EncounterWorkspaceLoadRequest): Promise<EncounterWorkspaceLoadResult> {
    return this.loadInternal(request)
  }

  private async loadInternal(
    request: EncounterWorkspaceLoadRequest,
  ): Promise<EncounterWorkspaceLoadResult> {
    const { context } = request
    const key = matchKeyFromContext(context)

    const probeState = await this.workspaceRepo.probeDocumentState(key)
    this.log.debug('encounterWorkspaceLoad.probe', { matchId: key.matchId, probeState })

    if (probeState === 'corrupt') {
      this.log.error('encounterWorkspaceLoad.corrupt', { matchId: key.matchId })
      throw new EncounterWorkspaceLoadError(
        'CORRUPT_DOCUMENT',
        'Encounter Workspace corrupto o inválido',
      )
    }

    let createdShell = false
    let workspace
    try {
      const ensured = await this.workspaceRepo.ensureWorkspaceForContext(context, this.createdBy)
      workspace = ensured.workspace
      createdShell = ensured.created
    } catch (err) {
      if (err instanceof ActaPersistenceError) {
        throw workspaceLoadErrorFromPersistence(err)
      }
      throw err
    }

    const source = resolveLoadSource(workspace, createdShell)
    const lifecycle = resolveLifecycleFromWorkspace(workspace)

    let report
    try {
      report = hydrateMatchReportFromWorkspace(workspace, { context })
    } catch (err) {
      this.log.error('encounterWorkspaceLoad.hydrate.failed', {
        matchId: key.matchId,
        message: err instanceof Error ? err.message : String(err),
      })
      throw new EncounterWorkspaceLoadError(
        'HYDRATE_FAILED',
        err instanceof Error ? err.message : 'Error hidratando Encounter Workspace',
      )
    }

    const document =
      source === 'workspace_acta' ? actaProjectionFromWorkspace(workspace) : undefined

    this.log.debug('encounterWorkspaceLoad.ok', {
      matchId: key.matchId,
      source,
      lifecycle,
      workspaceVersion: workspace.metadata.workspaceVersion,
      actaBinding: workspace.workflow.actaBinding,
      hasActa: workspace.acta != null,
      hydrateFromActa: shouldHydrateActaFromWorkspace(workspace),
    })

    return {
      source,
      lifecycle,
      report,
      workspace,
      document,
      workspaceVersion: workspace.metadata.workspaceVersion,
    }
  }
}

function resolveLoadSource(
  workspace: EncounterWorkspaceLoadResult['workspace'],
  createdShell: boolean,
): EncounterWorkspaceLoadSource {
  if (shouldUseActaSectionForHydration(workspace)) {
    return 'workspace_acta'
  }
  if (createdShell) {
    return 'workspace_shell'
  }
  return 'workspace_alignments'
}

function defaultLoadLogger(): EncounterWorkspaceLoadLogger {
  return {
    debug: (event, data) => {
      if (import.meta.env.DEV) {
        console.debug(`[encounterWorkspaceLoad] ${event}`, data ?? '')
      }
    },
    warn: (event, data) => {
      console.warn(`[encounterWorkspaceLoad] ${event}`, data ?? '')
    },
    error: (event, data) => {
      console.error(`[encounterWorkspaceLoad] ${event}`, data ?? '')
    },
  }
}

export { matchKeyFromContext }
