/**
 * Store Drive simulado para Encounter Workspace (tmp/backup/previous).
 */

import type { ActaDocumentV1, ActaMatchKey } from '../contracts/actaDocument'
import { legacyActaDocumentToWorkspace } from '../adapters/workspaceActa.mapper'
import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'
import { validateEncounterWorkspaceDocument } from '@/shared/contracts/validateEncounterWorkspaceDocument'
import type {
  EncounterWorkspaceProbeState,
  EncounterWorkspaceStore,
} from '../persistence/encounterWorkspace.repository'
import { ActaPersistenceError } from '../persistence/actaPersistenceError'
import { buildWorkspaceStorageKey } from '../persistence/workspaceRepositoryKeys'
import {
  atomicReplaceWorkspaceInMap,
  findWorkspaceByMatchIdInMap,
  normalizeStoredWorkspace,
  readOfficialWorkspaceFromMap,
  serializeEncounterWorkspace,
  type DriveFileMap,
} from './workspaceDriveFilePipeline'

export class FakeDriveEncounterWorkspaceStore implements EncounterWorkspaceStore {
  private readonly files: DriveFileMap = new Map()
  private readonly matchIndex = new Map<string, string>()
  private failNextAtomic = false

  getFiles(): DriveFileMap {
    return this.files
  }

  simulateAtomicReplaceFailure(): void {
    this.failNextAtomic = true
  }

  /** Compat tests: inyecta acta legacy y la normaliza a workspace en almacén. */
  injectRawDocument(key: ActaMatchKey, acta: ActaDocumentV1): void {
    this.injectRawWorkspace(key, legacyActaDocumentToWorkspace(acta))
  }

  injectRawWorkspace(key: ActaMatchKey, workspace: EncounterWorkspaceDocumentV1): void {
    const json = serializeEncounterWorkspace(workspace)
    atomicReplaceWorkspaceInMap(this.files, workspace.identity.documentFileName, json)
    this.matchIndex.set(buildWorkspaceStorageKey(key), workspace.identity.documentFileName)
  }

  injectCorruptOfficial(key: ActaMatchKey, documentFileName: string, rawContent: string): void {
    this.files.set(`${documentFileName}.json`, { content: rawContent })
    this.matchIndex.set(buildWorkspaceStorageKey(key), documentFileName)
  }

  async probeDocumentState(key: ActaMatchKey): Promise<EncounterWorkspaceProbeState> {
    const indexed = this.matchIndex.get(buildWorkspaceStorageKey(key))
    const documentFileName =
      indexed ?? findWorkspaceByMatchIdInMap(this.files, key.matchId)?.documentFileName
    if (!documentFileName) return 'absent'
    const entry = this.files.get(`${documentFileName}.json`)
    if (!entry) return 'absent'
    const workspace = normalizeStoredWorkspace(safeParseEntry(entry.content))
    if (!workspace) return 'corrupt'
    if (workspace.identity.matchId !== key.matchId) return 'corrupt'
    const validation = validateEncounterWorkspaceDocument(workspace, {
      expectedMatchId: key.matchId,
      strictMaterializePolicy: false,
    })
    if (!validation.ok) return 'corrupt'
    return 'valid'
  }

  async hasEntry(key: ActaMatchKey): Promise<boolean> {
    return (
      this.matchIndex.has(buildWorkspaceStorageKey(key)) ||
      findWorkspaceByMatchIdInMap(this.files, key.matchId) != null
    )
  }

  async readCommitted(key: ActaMatchKey): Promise<EncounterWorkspaceDocumentV1 | null> {
    const indexed = this.matchIndex.get(buildWorkspaceStorageKey(key))
    if (indexed) {
      return readOfficialWorkspaceFromMap(this.files, indexed)
    }
    const found = findWorkspaceByMatchIdInMap(this.files, key.matchId)
    if (!found) return null
    this.matchIndex.set(buildWorkspaceStorageKey(key), found.documentFileName)
    return found.workspace
  }

  async atomicReplace(key: ActaMatchKey, workspace: EncounterWorkspaceDocumentV1): Promise<void> {
    if (this.failNextAtomic) {
      this.failNextAtomic = false
      throw new ActaPersistenceError('IO_FAILURE', 'Simulación de fallo en atomic replace')
    }
    const documentFileName = workspace.identity.documentFileName
    const json = serializeEncounterWorkspace(workspace)
    const result = atomicReplaceWorkspaceInMap(this.files, documentFileName, json)
    if (!result.ok) {
      throw new ActaPersistenceError(result.code ?? 'IO_FAILURE', result.message ?? 'atomic replace fallido')
    }
    this.matchIndex.set(buildWorkspaceStorageKey(key), documentFileName)
  }
}

function safeParseEntry(content: string): unknown {
  try {
    return JSON.parse(content) as unknown
  } catch {
    return null
  }
}
