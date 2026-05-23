/**
 * Repositorio in-memory para validar arquitectura documental antes de Drive/GAS.
 * Delega en `ActaRepositoryCore` + store en Map.
 */

import type {
  ActaDocumentV1,
  ActaLifecycleState,
  ActaMatchKey,
  ActaRepository,
  ActaSaveOptions,
  ActaSaveResult,
  ActaAdminRepository,
  ReopenAuditPayload,
} from '../contracts/actaDocument'
import type { ActaDocumentStore } from '../persistence/actaRepositoryCore'
import { ActaRepositoryCore } from '../persistence/actaRepositoryCore'
import { ActaPersistenceError, cloneDocument } from '../persistence/actaPersistenceError'
import { buildStorageKey, keyFromDocument } from '../persistence/actaRepositoryKeys'

export { ActaPersistenceError, cloneDocument, buildStorageKey, keyFromDocument }

export interface InMemoryActaRepositoryOptions {
  readonly now?: () => string
}

class InMemoryActaDocumentStore implements ActaDocumentStore {
  private readonly store = new Map<string, ActaDocumentV1>()
  readonly corruptKeys = new Set<string>()

  async hasEntry(key: ActaMatchKey): Promise<boolean> {
    return this.store.has(buildStorageKey(key))
  }

  async readCommitted(key: ActaMatchKey): Promise<ActaDocumentV1 | null> {
    const storageKey = buildStorageKey(key)
    if (this.corruptKeys.has(storageKey)) {
      this.corruptKeys.delete(storageKey)
      throw new ActaPersistenceError('CORRUPT_DOCUMENT', 'Documento marcado como corrupto (simulación)')
    }
    const doc = this.store.get(storageKey)
    return doc ? cloneDocument(doc) : null
  }

  async atomicReplace(key: ActaMatchKey, document: ActaDocumentV1): Promise<void> {
    this.store.set(buildStorageKey(key), cloneDocument(document))
  }

  peek(key: ActaMatchKey): ActaDocumentV1 | undefined {
    const doc = this.store.get(buildStorageKey(key))
    return doc ? cloneDocument(doc) : undefined
  }

  injectRaw(key: ActaMatchKey, document: ActaDocumentV1): void {
    this.store.set(buildStorageKey(key), cloneDocument(document))
    this.corruptKeys.delete(buildStorageKey(key))
  }

  clear(): void {
    this.store.clear()
    this.corruptKeys.clear()
  }
}

/** Sandbox documental: `ActaRepository` + `ActaAdminRepository` en memoria. */
export class InMemoryActaRepository implements ActaRepository, ActaAdminRepository {
  private readonly store: InMemoryActaDocumentStore
  private readonly core: ActaRepositoryCore

  constructor(options: InMemoryActaRepositoryOptions = {}) {
    this.store = new InMemoryActaDocumentStore()
    this.core = new ActaRepositoryCore(this.store, options)
  }

  simulateCorruptionOnNextLoad(key: ActaMatchKey): void {
    this.store.corruptKeys.add(buildStorageKey(key))
  }

  injectRawDocument(key: ActaMatchKey, document: ActaDocumentV1): void {
    this.store.injectRaw(key, document)
  }

  clear(): void {
    this.store.clear()
  }

  peekCommitted(key: ActaMatchKey): ActaDocumentV1 | undefined {
    return this.store.peek(key)
  }

  resolveLifecycle(key: ActaMatchKey): Promise<ActaLifecycleState> {
    return this.core.resolveLifecycle(key)
  }

  load(key: ActaMatchKey): Promise<ActaDocumentV1 | null> {
    return this.core.load(key)
  }

  save(document: ActaDocumentV1, options: ActaSaveOptions): Promise<ActaSaveResult> {
    return this.core.save(document, options)
  }

  reopen(key: ActaMatchKey, audit: ReopenAuditPayload): Promise<ActaDocumentV1> {
    return this.core.reopen(key, audit)
  }
}

export function createInMemoryActaRepository(
  options?: InMemoryActaRepositoryOptions,
): InMemoryActaRepository {
  return new InMemoryActaRepository(options)
}
