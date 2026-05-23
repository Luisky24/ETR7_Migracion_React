/**
 * Store Drive simulado en memoria (tmp/backup/previous) para tests del adapter JSON.
 */

import type { ActaDocumentV1, ActaMatchKey } from '../contracts/actaDocument'
import type { ActaDocumentStore } from '../persistence/actaRepositoryCore'
import { ActaPersistenceError } from '../persistence/actaPersistenceError'
import { buildStorageKey } from '../persistence/actaRepositoryKeys'
import {
  atomicReplaceDocumentInMap,
  findDocumentByMatchIdInMap,
  type DriveFileMap,
  readOfficialDocumentFromMap,
  safeParseJson,
  serializeActaDocument,
} from './actaDriveFilePipeline'

export type ActaDocumentProbeState = 'absent' | 'valid' | 'corrupt'

export class FakeDriveActaDocumentStore implements ActaDocumentStore {
  private readonly files: DriveFileMap = new Map()
  private readonly matchIndex = new Map<string, string>()
  private failNextAtomic = false

  getFiles(): DriveFileMap {
    return this.files
  }

  simulateAtomicReplaceFailure(): void {
    this.failNextAtomic = true
  }

  injectCorruptOfficial(key: ActaMatchKey, documentName: string, rawContent: string): void {
    this.files.set(`${documentName}.json`, { content: rawContent })
    this.matchIndex.set(buildStorageKey(key), documentName)
  }

  injectRawDocument(key: ActaMatchKey, document: ActaDocumentV1): void {
    const json = serializeActaDocument(document)
    atomicReplaceDocumentInMap(this.files, document.match.documentName, json)
    this.matchIndex.set(buildStorageKey(key), document.match.documentName)
  }

  /** Detecta ausencia, validez o corrupción sin hidratar runtime. */
  async probeDocumentState(key: ActaMatchKey): Promise<ActaDocumentProbeState> {
    const indexed = this.matchIndex.get(buildStorageKey(key))
    const documentName = indexed ?? findDocumentByMatchIdInMap(this.files, key.matchId)?.documentName
    if (!documentName) return 'absent'
    const entry = this.files.get(`${documentName}.json`)
    if (!entry) return 'absent'
    const parseResult = safeParseJson(entry.content)
    if (!parseResult.ok) return 'corrupt'
    const doc = parseResult.value as ActaDocumentV1
    if (doc?.match?.matchId !== key.matchId) return 'corrupt'
    if (!doc.metadata || doc.metadata.schemaVersion !== 1) return 'corrupt'
    if (doc.metadata.status === 'ACTA_CERRADA' && !doc.metadata.closedAt) return 'corrupt'
    return 'valid'
  }

  async hasEntry(key: ActaMatchKey): Promise<boolean> {
    return this.matchIndex.has(buildStorageKey(key)) || findDocumentByMatchIdInMap(this.files, key.matchId) != null
  }

  async readCommitted(key: ActaMatchKey): Promise<ActaDocumentV1 | null> {
    const indexed = this.matchIndex.get(buildStorageKey(key))
    if (indexed) {
      return readOfficialDocumentFromMap(this.files, indexed)
    }
    const found = findDocumentByMatchIdInMap(this.files, key.matchId)
    if (!found) return null
    this.matchIndex.set(buildStorageKey(key), found.documentName)
    return found.document
  }

  async atomicReplace(key: ActaMatchKey, document: ActaDocumentV1): Promise<void> {
    if (this.failNextAtomic) {
      this.failNextAtomic = false
      throw new ActaPersistenceError('IO_FAILURE', 'Simulación de fallo en atomic replace')
    }

    const documentName = document.match.documentName
    const json = serializeActaDocument(document)
    const result = atomicReplaceDocumentInMap(this.files, documentName, json)
    if (!result.ok) {
      throw new ActaPersistenceError(result.code ?? 'IO_FAILURE', result.message ?? 'atomic replace fallido')
    }
    this.matchIndex.set(buildStorageKey(key), documentName)
  }
}
