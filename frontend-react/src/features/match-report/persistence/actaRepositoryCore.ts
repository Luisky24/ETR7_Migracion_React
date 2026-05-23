/**
 * Motor puro del repositorio de actas JSON.
 * Compartido por InMemory y jsonPersistence (storage inyectable).
 */

import type {
  ActaDocumentMetadata,
  ActaDocumentV1,
  ActaLifecycleState,
  ActaMatchKey,
  ActaPersistenceErrorCode,
  ActaRepository,
  ActaSaveOptions,
  ActaSaveResult,
  ActaAdminRepository,
  ReopenAuditPayload,
} from '../contracts/actaDocument'
import {
  assertLifecycleTransition,
  lifecycleFromDocumentStatus,
  nextLifecycleAfterTransition,
} from './lifecycleRules'
import {
  validateActaDocument,
  validateReopenMetadata,
  validateSaveIntent,
} from './documentValidators'
import { ActaPersistenceError, cloneDocument } from './actaPersistenceError'
import { ActaLifecycleViolationError } from './types'
import { keyFromDocument } from './actaRepositoryKeys'

export interface ActaDocumentStore {
  readCommitted(key: ActaMatchKey): Promise<ActaDocumentV1 | null>
  atomicReplace(key: ActaMatchKey, document: ActaDocumentV1): Promise<void>
  hasEntry(key: ActaMatchKey): Promise<boolean>
}

export interface ActaRepositoryCoreOptions {
  readonly now?: () => string
  readonly log?: ActaJsonPersistenceLogger
}

export interface ActaJsonPersistenceLogger {
  debug(event: string, data?: Record<string, unknown>): void
  warn(event: string, data?: Record<string, unknown>): void
  error(event: string, data?: Record<string, unknown>): void
}

const noopLog: ActaJsonPersistenceLogger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
}

export class ActaRepositoryCore implements ActaRepository, ActaAdminRepository {
  private readonly now: () => string
  private readonly log: ActaJsonPersistenceLogger

  constructor(
    private readonly store: ActaDocumentStore,
    options: ActaRepositoryCoreOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString())
    this.log = options.log ?? noopLog
  }

  async resolveLifecycle(key: ActaMatchKey): Promise<ActaLifecycleState> {
    const doc = await this.store.readCommitted(key)
    if (!doc) return 'NO_EXISTE'
    return lifecycleFromDocumentStatus(doc.metadata.status)
  }

  async load(key: ActaMatchKey): Promise<ActaDocumentV1 | null> {
    const doc = await this.store.readCommitted(key)
    if (!doc) return null

    const clone = cloneDocument(doc)
    const validation = validateActaDocument(clone, { expectedMatchId: key.matchId })
    if (!validation.ok) {
      this.log.error('actaJson.load.corrupt', { matchId: key.matchId, issues: validation.issues })
      throw new ActaPersistenceError(
        'CORRUPT_DOCUMENT',
        validation.issues.map((i) => i.message).join('; '),
      )
    }

    this.log.debug('actaJson.load.ok', { matchId: key.matchId, version: clone.metadata.documentVersion })
    return clone
  }

  async save(document: ActaDocumentV1, options: ActaSaveOptions): Promise<ActaSaveResult> {
    const key = keyFromDocument(document)
    if (document.match.matchId !== key.matchId) {
      return fail('VALIDATION_FAILED', 'matchId del documento no coincide con la clave')
    }

    const currentLifecycle = await this.resolveLifecycle(key)
    const existing = await this.store.readCommitted(key)

    if (currentLifecycle !== 'NO_EXISTE' && options.expectedDocumentVersion == null) {
      return fail(
        'ALREADY_EXISTS',
        'Documento ya existe; proporcione expectedDocumentVersion para actualizar',
      )
    }

    try {
      if (currentLifecycle === 'NO_EXISTE') {
        return await this.saveCreate(key, document, options)
      }
      return await this.saveUpdate(key, existing!, document, options, currentLifecycle)
    } catch (err) {
      if (err instanceof ActaLifecycleViolationError) {
        this.log.warn('actaJson.save.lifecycle', { matchId: key.matchId, message: err.message })
        return fail('LIFECYCLE_VIOLATION', err.message)
      }
      if (err instanceof ActaPersistenceError) {
        this.log.error('actaJson.save.error', { matchId: key.matchId, code: err.code, message: err.message })
        return fail(err.code, err.message)
      }
      throw err
    }
  }

  async reopen(key: ActaMatchKey, audit: ReopenAuditPayload): Promise<ActaDocumentV1> {
    const existing = await this.store.readCommitted(key)
    if (!existing) {
      throw new ActaPersistenceError('LIFECYCLE_VIOLATION', 'No existe acta para reabrir')
    }

    const currentLifecycle = lifecycleFromDocumentStatus(existing.metadata.status)
    assertLifecycleTransition(currentLifecycle, 'REOPEN')

    const reopenedAt = this.now()
    const auditValidation = validateReopenMetadata(audit.reopenedBy, reopenedAt)
    if (!auditValidation.ok) {
      throw new ActaPersistenceError(
        'VALIDATION_FAILED',
        auditValidation.issues.map((i) => i.message).join('; '),
      )
    }

    const nextVersion = existing.metadata.documentVersion + 1
    const staged = cloneDocument(existing)
    const nextMeta: ActaDocumentMetadata = {
      ...staged.metadata,
      status: 'ACTA_EN_CURSO',
      documentVersion: nextVersion,
      updatedAt: reopenedAt,
      reopenedAt,
      reopenedBy: audit.reopenedBy.trim(),
      reopenReason: audit.reopenReason?.trim() || undefined,
      lastSavedBy: audit.reopenedBy.trim(),
    }

    const commitDoc: ActaDocumentV1 = { ...staged, metadata: nextMeta }
    const committed = await this.atomicCommit(key, commitDoc)
    this.log.debug('actaJson.reopen.ok', { matchId: key.matchId, version: committed.metadata.documentVersion })
    return committed
  }

  private async saveCreate(
    key: ActaMatchKey,
    incoming: ActaDocumentV1,
    options: ActaSaveOptions,
  ): Promise<ActaSaveResult> {
    if (await this.store.hasEntry(key)) {
      return fail('ALREADY_EXISTS', 'Ya existe un acta para esta clave')
    }
    if (options.expectedDocumentVersion != null) {
      return fail('VALIDATION_FAILED', 'create no admite expectedDocumentVersion')
    }
    if (options.intent === 'close') {
      return fail('LIFECYCLE_VIOLATION', 'No se puede cerrar sin acta previa en curso')
    }

    assertLifecycleTransition('NO_EXISTE', 'FIRST_SAVE')

    const timestamp = this.now()
    const staged = cloneDocument(incoming)
    const metadata: ActaDocumentMetadata = {
      ...staged.metadata,
      schemaVersion: 1,
      documentVersion: 1,
      status: 'ACTA_EN_CURSO',
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: options.savedBy ?? staged.metadata.createdBy,
      lastSavedBy: options.savedBy ?? staged.metadata.lastSavedBy,
      closedAt: undefined,
      closedBy: undefined,
    }

    const commitDoc: ActaDocumentV1 = { ...staged, metadata }
    const intentValidation = validateSaveIntent('ACTA_EN_CURSO', options)
    if (!intentValidation.ok) {
      return fail('VALIDATION_FAILED', intentValidation.issues[0]?.message)
    }

    try {
      const committed = await this.atomicCommit(key, commitDoc)
      this.log.debug('actaJson.create.ok', { matchId: key.matchId })
      return { ok: true, documentVersion: committed.metadata.documentVersion }
    } catch (err) {
      if (err instanceof ActaPersistenceError) {
        return fail(err.code, err.message)
      }
      throw err
    }
  }

  private async saveUpdate(
    key: ActaMatchKey,
    stored: ActaDocumentV1,
    incoming: ActaDocumentV1,
    options: ActaSaveOptions,
    currentLifecycle: ActaLifecycleState,
  ): Promise<ActaSaveResult> {
    if (options.expectedDocumentVersion == null) {
      return fail('VALIDATION_FAILED', 'expectedDocumentVersion obligatoria en update')
    }

    if (currentLifecycle === 'ACTA_CERRADA') {
      return fail('LIFECYCLE_VIOLATION', 'Acta cerrada: use reopen admin antes de guardar')
    }

    const transition = options.intent === 'close' ? 'CLOSE' : 'SAVE_DRAFT'
    assertLifecycleTransition(currentLifecycle, transition)

    const versionCheck = assertVersion(stored.metadata.documentVersion, options.expectedDocumentVersion)
    if (!versionCheck.ok) {
      this.log.warn('actaJson.save.conflict', {
        matchId: key.matchId,
        stored: stored.metadata.documentVersion,
        expected: options.expectedDocumentVersion,
      })
      return versionCheck
    }

    const nextLifecycle = nextLifecycleAfterTransition(currentLifecycle, transition)
    const nextStatus = nextLifecycle === 'ACTA_CERRADA' ? 'ACTA_CERRADA' : 'ACTA_EN_CURSO'
    const intentValidation = validateSaveIntent(stored.metadata.status, {
      ...options,
      intent: options.intent === 'close' ? 'close' : 'draft',
    })
    if (!intentValidation.ok) {
      return fail('VALIDATION_FAILED', intentValidation.issues[0]?.message)
    }

    const timestamp = this.now()
    const nextVersion = stored.metadata.documentVersion + 1
    const staged = cloneDocument(incoming)

    const metadata: ActaDocumentMetadata = {
      ...staged.metadata,
      schemaVersion: 1,
      documentVersion: nextVersion,
      status: nextStatus,
      createdAt: stored.metadata.createdAt,
      createdBy: stored.metadata.createdBy,
      updatedAt: timestamp,
      lastSavedBy: options.savedBy ?? staged.metadata.lastSavedBy,
      closedAt: nextStatus === 'ACTA_CERRADA' ? timestamp : stored.metadata.closedAt,
      closedBy:
        nextStatus === 'ACTA_CERRADA'
          ? (options.savedBy ?? stored.metadata.closedBy)
          : stored.metadata.closedBy,
      reopenedAt: stored.metadata.reopenedAt,
      reopenedBy: stored.metadata.reopenedBy,
      reopenReason: stored.metadata.reopenReason,
    }

    const commitDoc: ActaDocumentV1 = { ...staged, metadata }

    try {
      const committed = await this.atomicCommit(key, commitDoc)
      const event = options.intent === 'close' ? 'actaJson.close.ok' : 'actaJson.save.ok'
      this.log.debug(event, { matchId: key.matchId, version: committed.metadata.documentVersion })
      return { ok: true, documentVersion: committed.metadata.documentVersion }
    } catch (err) {
      if (err instanceof ActaPersistenceError) {
        return fail(err.code, err.message)
      }
      throw err
    }
  }

  private async atomicCommit(key: ActaMatchKey, staged: ActaDocumentV1): Promise<ActaDocumentV1> {
    const tmp = cloneDocument(staged)
    validateBeforeCommit(tmp, key)
    await this.store.atomicReplace(key, tmp)
    return cloneDocument(tmp)
  }
}

function validateBeforeCommit(doc: ActaDocumentV1, key: ActaMatchKey): void {
  const validation = validateActaDocument(doc, { expectedMatchId: key.matchId })
  if (!validation.ok) {
    throw new ActaPersistenceError(
      'VALIDATION_FAILED',
      validation.issues.map((i) => i.message).join('; '),
    )
  }
}

function assertVersion(
  storedVersion: number,
  expected: number | undefined,
): ActaSaveResult | { ok: true } {
  if (expected == null) {
    return fail('VALIDATION_FAILED', 'expectedDocumentVersion obligatoria')
  }
  if (storedVersion !== expected) {
    return fail(
      'DOCUMENT_VERSION_CONFLICT',
      `Versión en almacén ${storedVersion} ≠ esperada ${expected}`,
    )
  }
  return { ok: true }
}

function fail(code: ActaPersistenceErrorCode, message?: string): ActaSaveResult {
  return { ok: false, code, message }
}
