/**
 * Repositorio JSON oficial — persistencia Encounter Workspace con frontera ActaDocumentV1.
 */

import type {
  ActaAdminRepository,
  ActaRepository,
} from '../contracts/actaDocument'
import {
  ActaRepositoryCore,
  type ActaRepositoryCoreOptions,
  type ActaJsonPersistenceLogger,
} from '../persistence/actaRepositoryCore'
import {
  EncounterWorkspaceRepository,
  WorkspaceBackingActaDocumentStore,
} from '../persistence/encounterWorkspace.repository'
import { DriveGasEncounterWorkspaceStore } from './driveGasEncounterWorkspaceStore'
import { FakeDriveEncounterWorkspaceStore } from './fakeDriveEncounterWorkspaceStore'
import type { EncounterWorkspaceStore } from '../persistence/encounterWorkspace.repository'

export { ActaPersistenceError } from '../persistence/actaPersistenceError'

export interface JsonPersistenceRepositoryOptions extends ActaRepositoryCoreOptions {
  /** Store workspace inyectable (tests). */
  readonly workspaceStore?: EncounterWorkspaceStore
}

function buildActaStore(options: JsonPersistenceRepositoryOptions): WorkspaceBackingActaDocumentStore {
  const workspaceStore = options.workspaceStore ?? new DriveGasEncounterWorkspaceStore()
  const workspaceRepo = new EncounterWorkspaceRepository(workspaceStore, options.log)
  return new WorkspaceBackingActaDocumentStore(workspaceRepo)
}

/**
 * Repositorio JSON con persistencia workspace (Drive/GAS).
 */
export function createJsonPersistenceRepository(
  options: JsonPersistenceRepositoryOptions = {},
): ActaRepository & ActaAdminRepository {
  const log: ActaJsonPersistenceLogger = options.log ?? defaultLogger()
  const actaStore = buildActaStore({ ...options, log })
  return new ActaRepositoryCore(actaStore, { ...options, log })
}

/** Repositorio JSON con filesystem workspace simulado (tests). */
export function createFakeDriveJsonPersistenceRepository(
  options: JsonPersistenceRepositoryOptions = {},
): ActaRepository &
  ActaAdminRepository & { readonly driveStore: FakeDriveEncounterWorkspaceStore } {
  const driveStore = new FakeDriveEncounterWorkspaceStore()
  const actaStore = buildActaStore({ ...options, workspaceStore: driveStore })
  const repo = new ActaRepositoryCore(actaStore, options)
  return Object.assign(repo, { driveStore })
}

function defaultLogger(): ActaJsonPersistenceLogger {
  return {
    debug: (event, data) => {
      if (import.meta.env.DEV) {
        console.debug(`[actaJson] ${event}`, data ?? '')
      }
    },
    warn: (event, data) => {
      console.warn(`[actaJson] ${event}`, data ?? '')
    },
    error: (event, data) => {
      console.error(`[actaJson] ${event}`, data ?? '')
    },
  }
}
