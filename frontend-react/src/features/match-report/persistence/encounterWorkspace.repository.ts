/**
 * Repositorio documental Encounter Workspace — persistencia atómica del agregado completo.
 * ActaDocumentV1 sigue siendo la frontera hacia ActaRepositoryCore vía adapter.
 */

import type { ActaDocumentV1, ActaMatchKey } from '../contracts/actaDocument'
import type { EncounterWorkspaceDocumentV1, WorkspaceMutationKind } from '@/shared/contracts/encounter-workspace.document'
import { validateEncounterWorkspaceDocument } from '@/shared/contracts/validateEncounterWorkspaceDocument'
import { ActaPersistenceError } from './actaPersistenceError'
import {
  actaDocumentV1FromWorkspace,
  applyWorkspaceVersionCommit,
  createEncounterWorkspaceFromActaDocument,
  mergeActaIntoWorkspace,
  normalizeAlignmentsForWorkspaceCommit,
} from '../adapters/workspaceActa.mapper'
import { cloneWorkspace } from '../infra/workspaceDriveFilePipeline'
import type { ActaDocumentStore } from './actaRepositoryCore'
import type { MatchContext } from '../contracts'
import { createEncounterWorkspace } from '../adapters/workspaceActa.mapper'
import { stableEncounterNumberFromMatchId } from './encounterIdentity'
import { matchKeyFromContext } from './matchKey'

export type EncounterWorkspaceProbeState = 'absent' | 'valid' | 'corrupt'

export interface EncounterWorkspaceStore {
  probeDocumentState(key: ActaMatchKey): Promise<EncounterWorkspaceProbeState>
  hasEntry(key: ActaMatchKey): Promise<boolean>
  readCommitted(key: ActaMatchKey): Promise<EncounterWorkspaceDocumentV1 | null>
  atomicReplace(key: ActaMatchKey, workspace: EncounterWorkspaceDocumentV1): Promise<void>
}

export interface EncounterWorkspaceRepositoryLogger {
  debug(event: string, data?: Record<string, unknown>): void
  warn(event: string, data?: Record<string, unknown>): void
  error(event: string, data?: Record<string, unknown>): void
}

const noopLog: EncounterWorkspaceRepositoryLogger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
}

export class EncounterWorkspaceRepository {
  constructor(
    private readonly store: EncounterWorkspaceStore,
    private readonly log: EncounterWorkspaceRepositoryLogger = noopLog,
  ) {}

  async probeDocumentState(key: ActaMatchKey): Promise<EncounterWorkspaceProbeState> {
    return this.store.probeDocumentState(key)
  }

  async probeForActaBootstrap(key: ActaMatchKey): Promise<EncounterWorkspaceProbeState> {
    return this.store.probeDocumentState(key)
  }

  async hasEntry(key: ActaMatchKey): Promise<boolean> {
    return this.store.hasEntry(key)
  }

  /**
   * Garantiza shell documental: crea workspace vacío (`acta: null`) si no existe fichero.
   */
  async ensureWorkspaceForContext(
    context: MatchContext,
    createdBy: string,
  ): Promise<{ readonly workspace: EncounterWorkspaceDocumentV1; readonly created: boolean }> {
    const key = matchKeyFromContext(context)
    const existing = await this.loadWorkspace(key)
    if (existing) {
      return { workspace: existing, created: false }
    }
    const encounterNumber = stableEncounterNumberFromMatchId(context.encuentroId)
    const shell = createEncounterWorkspace({
      key,
      encounterNumber,
      grupo: context.grupo,
      equipoLocal: context.equipoLocal,
      equipoVisitante: context.equipoVisitante,
      hora: context.hora,
      campo: context.campo,
      referenciaEncuentro: context.referenciaEncuentro,
      createdBy,
    })
    try {
      const committed = await this.atomicReplaceWorkspace(key, shell)
      this.log.debug('encounterWorkspace.shell.created', {
        matchId: key.matchId,
        workspaceVersion: committed.metadata.workspaceVersion,
      })
      return { workspace: committed, created: true }
    } catch (err) {
      if (err instanceof ActaPersistenceError) {
        throw err
      }
      throw new ActaPersistenceError(
        'IO_FAILURE',
        err instanceof Error ? err.message : 'No se pudo materializar Encounter Workspace',
      )
    }
  }

  async loadWorkspace(key: ActaMatchKey): Promise<EncounterWorkspaceDocumentV1 | null> {
    const ws = await this.store.readCommitted(key)
    if (!ws) return null
    const staged = cloneWorkspace(ws)
    const validation = validateEncounterWorkspaceDocument(staged, {
      expectedMatchId: key.matchId,
      strictMaterializePolicy: false,
      editIntent: 'read',
    })
    if (!validation.ok) {
      const messages = validation.issues
        .filter((i) => i.severity === 'error')
        .map((i) => i.message)
        .join('; ')
      throw new ActaPersistenceError('CORRUPT_DOCUMENT', messages || 'Workspace corrupto')
    }
    return staged
  }

  async loadActaDocument(key: ActaMatchKey): Promise<ActaDocumentV1 | null> {
    const ws = await this.loadWorkspace(key)
    if (!ws) return null
    const acta = actaDocumentV1FromWorkspace(ws)
    if (!acta) return null
    if (acta.match.matchId !== key.matchId) {
      throw new ActaPersistenceError('CORRUPT_DOCUMENT', 'matchId incoherente en workspace')
    }
    this.log.debug('encounterWorkspace.loadActa.ok', {
      matchId: key.matchId,
      workspaceVersion: ws.metadata.workspaceVersion,
    })
    return acta
  }

  /**
   * Persiste el agregado completo tras validación WS-*.
   */
  async atomicReplaceWorkspace(
    key: ActaMatchKey,
    workspace: EncounterWorkspaceDocumentV1,
  ): Promise<EncounterWorkspaceDocumentV1> {
    const staged = normalizeAlignmentsForWorkspaceCommit(cloneWorkspace(workspace))
    this.validateBeforeCommit(staged, key)
    await this.store.atomicReplace(key, staged)
    this.log.debug('encounterWorkspace.commit.ok', {
      matchId: key.matchId,
      workspaceVersion: staged.metadata.workspaceVersion,
      phase: staged.lifecycle.phase,
    })
    return staged
  }

  /**
   * Convierte ActaDocumentV1 (frontera legacy) → workspace y persiste.
   */
  async persistActaDocument(key: ActaMatchKey, acta: ActaDocumentV1): Promise<ActaDocumentV1> {
    const existing = await this.loadWorkspace(key)
    const savedBy = acta.metadata.lastSavedBy ?? acta.metadata.createdBy ?? 'etr7-persistence'
    const targetVersion = acta.metadata.documentVersion

    let workspace: EncounterWorkspaceDocumentV1
    if (!existing) {
      workspace = createEncounterWorkspaceFromActaDocument(acta, savedBy)
      workspace = applyWorkspaceVersionCommit(workspace, targetVersion, {
        savedBy,
        mutationKind: mutationKindForActa(acta),
        auditKind: targetVersion === 1 ? 'ACTA_MATERIALIZED' : auditKindForActa(acta),
      })
    } else {
      const merged = mergeActaIntoWorkspace(existing, acta, {
        savedBy,
        mutationKind: mutationKindForActa(acta),
      })
      workspace = applyWorkspaceVersionCommit(merged, targetVersion, {
        savedBy,
        mutationKind: mutationKindForActa(acta),
        auditKind: auditKindForActa(acta),
      })
    }

    const committed = await this.atomicReplaceWorkspace(key, workspace)
    const out = actaDocumentV1FromWorkspace(committed)
    if (!out) {
      throw new ActaPersistenceError('CORRUPT_DOCUMENT', 'workspace sin acta tras commit')
    }
    return out
  }

  private validateBeforeCommit(workspace: EncounterWorkspaceDocumentV1, key: ActaMatchKey): void {
    const result = validateEncounterWorkspaceDocument(workspace, {
      expectedMatchId: key.matchId,
      strictMaterializePolicy: false,
      editIntent: 'read',
    })
    if (!result.ok) {
      const messages = result.issues
        .filter((i) => i.severity === 'error')
        .map((i) => i.message)
        .join('; ')
      this.log.error('encounterWorkspace.validate.fail', { matchId: key.matchId, messages })
      throw new ActaPersistenceError('VALIDATION_FAILED', messages || 'Workspace inválido')
    }
  }
}

/** Adaptador: ActaRepositoryCore sigue operando ActaDocumentV1. */
export class WorkspaceBackingActaDocumentStore implements ActaDocumentStore {
  constructor(private readonly workspaceRepo: EncounterWorkspaceRepository) {}

  async hasEntry(key: ActaMatchKey): Promise<boolean> {
    return this.workspaceRepo.hasEntry(key)
  }

  async readCommitted(key: ActaMatchKey): Promise<ActaDocumentV1 | null> {
    return this.workspaceRepo.loadActaDocument(key)
  }

  async atomicReplace(key: ActaMatchKey, document: ActaDocumentV1): Promise<void> {
    await this.workspaceRepo.persistActaDocument(key, document)
  }
}

function mutationKindForActa(acta: ActaDocumentV1): WorkspaceMutationKind {
  if (acta.metadata.status === 'ACTA_CERRADA') return 'ACTA_CLOSE'
  return 'ACTA_SAVE_DRAFT'
}

function auditKindForActa(acta: ActaDocumentV1): EncounterWorkspaceDocumentV1['audit']['events'][number]['kind'] {
  if (acta.metadata.reopenedAt && acta.metadata.status === 'ACTA_EN_CURSO') return 'ACTA_REOPENED'
  if (acta.metadata.status === 'ACTA_CERRADA') return 'ACTA_CLOSED'
  return 'ACTA_SAVED'
}
