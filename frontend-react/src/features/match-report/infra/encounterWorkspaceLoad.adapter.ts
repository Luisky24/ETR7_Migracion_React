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
import { getDocumentStoreKind } from '@/app/runtimeProfile'
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
import type { AlignmentDocumentRepository } from '@/features/alineaciones-v2/persistence/alignmentDocument.repository'
import { reconcileAlignmentWorkspace } from '../adapters/alignmentWorkspace.integration'
import { shouldSupersedeActaDueToAlignments } from '../adapters/alignmentSuperseded.policy'
import { applyWorkspaceVersionCommit } from '../adapters/workspaceActa.mapper'

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
  /**
   * Integración A3.5: repositorio AlignmentDocumentV1 inyectable (tests/infra).
   * Si no se proporciona, el loader no materializa workspace.alignments desde AlignmentDocument.
   */
  readonly alignmentRepository?: AlignmentDocumentRepository
  /** Resolver de keys por lado (A3.5). */
  readonly resolveAlignmentKeys?: (context: EncounterWorkspaceLoadRequest['context']) => {
    readonly local: Parameters<AlignmentDocumentRepository['loadAlignmentDocument']>[0]
    readonly visitante: Parameters<AlignmentDocumentRepository['loadAlignmentDocument']>[0]
  }
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
  private readonly alignmentRepo?: AlignmentDocumentRepository
  private readonly resolveAlignmentKeys?: EncounterWorkspaceLoadAdapterOptions['resolveAlignmentKeys']

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
    this.alignmentRepo = options.alignmentRepository
    this.resolveAlignmentKeys = options.resolveAlignmentKeys
    this.log.debug('encounterWorkspaceLoad.store', { store: getDocumentStoreKind() })
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

    // A3.5: materializa workspace.alignments desde AlignmentDocumentRepository (sin Sheets) si está configurado.
    if (this.alignmentRepo && this.resolveAlignmentKeys) {
      try {
        const keys = this.resolveAlignmentKeys(context)
        const [localDoc, visitDoc] = await Promise.all([
          this.alignmentRepo.loadAlignmentDocument(keys.local),
          this.alignmentRepo.loadAlignmentDocument(keys.visitante),
        ])
        const reconciled = reconcileAlignmentWorkspace(workspace, {
          local: localDoc,
          visitante: visitDoc,
        })
        let patched = reconciled.patched ?? workspace

        // Política SUPERSEDED: alignment REOPENED + acta ACTIVE.
        const sup = shouldSupersedeActaDueToAlignments(patched, { local: localDoc, visitante: visitDoc })
        if (sup.shouldSupersede) {
          const supersedeAt = sup.at ?? new Date().toISOString()
          const supersedeBy = sup.by ?? this.createdBy
          patched = {
            ...patched,
            workflow: {
              ...patched.workflow,
              actaBinding: 'SUPERSEDED',
              lastReopen: {
                mode: 'REOPEN_ALIGNMENTS',
                at: supersedeAt,
                by: supersedeBy,
                fromWorkspaceVersion: patched.metadata.workspaceVersion,
                reason: sup.reason,
              },
            },
            // WS-6: SUPERSEDED no puede coexistir con acta en curso. Se congela acta como cerrada documentalmente.
            acta:
              patched.acta && patched.acta.status === 'ACTA_EN_CURSO'
                ? {
                    ...patched.acta,
                    status: 'ACTA_CERRADA',
                    closedAt: patched.acta.closedAt ?? supersedeAt,
                    closedBy: patched.acta.closedBy ?? supersedeBy,
                    updatedAt: supersedeAt,
                  }
                : patched.acta,
          }
        }

        // Persistimos solo si cambió (materialización o superseded).
        if (patched !== workspace) {
          const nextVersion = workspace.metadata.workspaceVersion + 1
          const committed = applyWorkspaceVersionCommit(patched, nextVersion, {
            savedBy: this.createdBy,
            mutationKind: 'ALIGNMENT_UPSERT',
            auditKind: sup.shouldSupersede ? 'ALIGNMENTS_REOPENED' : 'LIFECYCLE_TRANSITION',
          })
          await this.workspaceRepo.atomicReplaceWorkspace(key, committed)
          workspace = committed
        }
      } catch (err) {
        this.log.warn('encounterWorkspaceLoad.alignmentIntegration.failed', {
          matchId: key.matchId,
          message: err instanceof Error ? err.message : String(err),
        })
        // Non-fatal: fallback a workspace.alignments existente.
      }
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
