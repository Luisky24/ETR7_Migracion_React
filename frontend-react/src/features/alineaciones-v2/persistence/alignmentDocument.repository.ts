/**
 * Repositorio documental AlignmentDocumentV1 — persistencia atómica + validación + optimistic locking.
 * Fase A3: sin acoplarse al runtime React; consumidores futuros (UI/workspace) se integran después.
 */

import type { AlignmentDocumentV1 } from '@/shared/contracts/alignment.document'
import { nextCloseRevision } from '@/shared/contracts/alignment.helpers'
import { validateAlignmentDocument } from '@/shared/contracts/validateAlignmentDocument'
import { ActaPersistenceError } from '@/features/match-report/persistence/actaPersistenceError'
import type { DriveFileMap } from '../infra/alignmentDriveFilePipeline'
import {
  atomicReplaceAlignmentInMap,
  cloneAlignment,
  findAlignmentByStorageKeyInMap,
  readIndexFromMap,
  readOfficialAlignmentFromMap,
  serializeAlignmentDocument,
} from '../infra/alignmentDriveFilePipeline'
import {
  ALIGNMENT_INDEX_DOCUMENT_NAME,
  buildAlignmentDocumentName,
} from './alignmentRepositoryKeys'

export type AlignmentProbeState = 'absent' | 'valid' | 'corrupt'

export interface AlignmentDocumentKey {
  readonly storageKey: string
  readonly matchId: string
  readonly categoryId: string
  readonly seasonId: string
  readonly teamId: string
  readonly teamCode: string
  readonly roleInMatch: 'LOCAL' | 'VISITANTE'
  readonly phaseId: string
  readonly phaseCode: string
  readonly encounterId: string
  readonly encounterCode: string
}

export interface AlignmentDocumentStore {
  probeDocumentState(key: AlignmentDocumentKey): Promise<AlignmentProbeState>
  hasEntry(key: AlignmentDocumentKey): Promise<boolean>
  readCommitted(key: AlignmentDocumentKey): Promise<AlignmentDocumentV1 | null>
  atomicReplace(key: AlignmentDocumentKey, document: AlignmentDocumentV1): Promise<void>
  /**
   * Acceso auxiliar: mapa de ficheros para rebuild del índice en stores que lo soporten.
   * En Drive/GAS real se implementará con listado en server-side.
   */
  readAllFilesForDiagnostics?(): Promise<DriveFileMap>
  readIndexRaw?(): Promise<unknown | null>
  atomicReplaceIndexRaw?(rawIndexJson: string): Promise<void>
}

export interface AlignmentIndexEntryV1 {
  readonly storageKey: string
  readonly documentName: string
  readonly matchId: string
  /** Primer cierre del documento (closeRevision===1). */
  readonly firstClosedAt: string
  readonly closeRevision: number
}

export interface AlignmentIndexV1 {
  readonly schema: 'AlignmentIndexV1'
  readonly createdAt: string
  readonly updatedAt: string
  /** Por teamId (y season/category implícitos por repo). */
  readonly byTeamId: Readonly<Record<string, AlignmentIndexEntryV1>>
}

export interface AlignmentBootstrapper {
  bootstrapPlayersFromSheets(key: AlignmentDocumentKey): Promise<AlignmentDocumentV1['players']>
}

export interface AlignmentDocumentRepositoryLogger {
  debug(event: string, data?: Record<string, unknown>): void
  warn(event: string, data?: Record<string, unknown>): void
  error(event: string, data?: Record<string, unknown>): void
}

const noopLog: AlignmentDocumentRepositoryLogger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
}

export class AlignmentDocumentRepository {
  constructor(
    private readonly store: AlignmentDocumentStore,
    private readonly opts: {
      readonly now: () => string
      readonly bootstrapper?: AlignmentBootstrapper
      readonly log?: AlignmentDocumentRepositoryLogger
    },
  ) {}

  private get log(): AlignmentDocumentRepositoryLogger {
    return this.opts.log ?? noopLog
  }

  async probeAlignmentDocument(key: AlignmentDocumentKey): Promise<AlignmentProbeState> {
    return this.store.probeDocumentState(key)
  }

  async loadAlignmentDocument(key: AlignmentDocumentKey): Promise<AlignmentDocumentV1 | null> {
    const doc = await this.store.readCommitted(key)
    if (!doc) return null
    const staged = cloneAlignment(doc)
    const validation = validateAlignmentDocument(staged, {
      expectedMatchId: key.matchId,
    })
    if (!validation.ok) {
      const messages = validation.issues
        .filter((i) => i.severity === 'error')
        .map((i) => i.message)
        .join('; ')
      throw new ActaPersistenceError('CORRUPT_DOCUMENT', messages || 'Alignment corrupto')
    }
    return staged
  }

  /**
   * Crea el documento draft inicial si no existe.
   * Bootstrap permitido: desde último snapshot del índice o desde Sheets (solo aquí).
   */
  async ensureAlignmentDraft(key: AlignmentDocumentKey, createdBy: string): Promise<AlignmentDocumentV1> {
    const existing = await this.loadAlignmentDocument(key)
    if (existing) return existing

    const index = await this.readIndexSafe()
    const last = index?.byTeamId[key.teamId]

    let players: AlignmentDocumentV1['players'] = []
    let selection: AlignmentDocumentV1['selection'] = { starters: [], bench: [], captain: null, goalkeeper: null }
    let bootstrapSource: 'PREVIOUS_ALIGNMENT' | 'SHEETS' = 'SHEETS'
    let sourceRef: string | undefined

    if (last) {
      const prev = await this.loadByDocumentName(last.documentName, key)
      if (prev?.closure?.snapshot) {
        players = prev.closure.snapshot.players
        selection = prev.closure.snapshot.selection
        bootstrapSource = 'PREVIOUS_ALIGNMENT'
        sourceRef = prev.identity.storageKey
      }
    }

    if (players.length === 0) {
      if (!this.opts.bootstrapper) {
        throw new ActaPersistenceError(
          'IO_FAILURE',
          'No existe bootstrapper para jugadores Sheets (requerido para materialización inicial)',
        )
      }
      players = await this.opts.bootstrapper.bootstrapPlayersFromSheets(key)
      bootstrapSource = 'SHEETS'
      sourceRef = undefined
    }

    const documentName = buildAlignmentDocumentName(key.teamCode, key.phaseCode, key.encounterCode)
    const doc: AlignmentDocumentV1 = {
      schema: 'AlignmentDocumentV1',
      identity: {
        categoryId: key.categoryId,
        seasonId: key.seasonId,
        teamId: key.teamId,
        matchId: key.matchId,
        phaseId: key.phaseId,
        encounterId: key.encounterId,
        storageKey: key.storageKey,
        documentFileName: `${documentName}.json`,
      },
      metadata: {
        schemaVersion: 1,
        documentVersion: 1,
        createdAt: this.opts.now(),
        updatedAt: this.opts.now(),
        createdBy,
        updatedBy: createdBy,
      },
      team: {
        teamId: key.teamId,
        teamCode: key.teamCode,
        roleInMatch: key.roleInMatch,
      },
      match: {
        phaseId: key.phaseId,
        phaseCode: key.phaseCode,
        encounterId: key.encounterId,
        encounterCode: key.encounterCode,
        matchId: key.matchId,
      },
      players,
      selection,
      lifecycle: {
        state: 'DRAFT',
        history: [],
      },
      audit: {
        events: [
          { at: this.opts.now(), by: createdBy, kind: 'ALIGNMENT_CREATE' },
          {
            at: this.opts.now(),
            by: createdBy,
            kind: 'ALIGNMENT_BOOTSTRAP',
            payload: { source: bootstrapSource },
            ...(bootstrapSource === 'PREVIOUS_ALIGNMENT' ? { reason: sourceRef } : {}),
          },
        ],
      },
      sync: {
        bootstrap: {
          source: bootstrapSource,
          sourceRef,
          bootstrappedAt: this.opts.now(),
        },
      },
    }

    await this.atomicReplaceAlignment(key, doc, { expectedDocumentVersion: undefined })
    return doc
  }

  async saveAlignmentDraft(
    key: AlignmentDocumentKey,
    draft: AlignmentDocumentV1,
    options: { readonly expectedDocumentVersion: number; readonly savedBy: string },
  ): Promise<AlignmentDocumentV1> {
    // optimistic locking (A3): validate caller version against document
    if (draft.metadata.documentVersion !== options.expectedDocumentVersion) {
      throw new ActaPersistenceError('DOCUMENT_VERSION_CONFLICT', 'Versión esperada != documentVersion del draft')
    }

    const next: AlignmentDocumentV1 = {
      ...draft,
      metadata: {
        ...draft.metadata,
        documentVersion: draft.metadata.documentVersion + 1,
        updatedAt: this.opts.now(),
        updatedBy: options.savedBy,
      },
      audit: {
        events: [
          ...draft.audit.events,
          { at: this.opts.now(), by: options.savedBy, kind: 'ALIGNMENT_EDIT' },
        ],
      },
    }

    await this.atomicReplaceAlignment(key, next, { expectedDocumentVersion: options.expectedDocumentVersion + 1 })
    return next
  }

  async closeAlignment(
    key: AlignmentDocumentKey,
    draft: AlignmentDocumentV1,
    options: { readonly expectedDocumentVersion: number; readonly closedBy: string },
  ): Promise<AlignmentDocumentV1> {
    if (draft.metadata.documentVersion !== options.expectedDocumentVersion) {
      throw new ActaPersistenceError('DOCUMENT_VERSION_CONFLICT', 'Versión esperada != documentVersion del draft')
    }

    const closeRev = nextCloseRevision(draft)
    const closedAt = this.opts.now()

    const closed: AlignmentDocumentV1 = {
      ...draft,
      lifecycle: {
        state: 'CLOSED',
        history: [
          ...draft.lifecycle.history,
          { from: draft.lifecycle.state, to: 'CLOSED', at: closedAt, by: options.closedBy },
        ],
      },
      closure: {
        closedAt,
        closedBy: options.closedBy,
        closeRevision: closeRev,
        snapshot: {
          players: cloneAlignment({ ...draft, schema: 'AlignmentDocumentV1' }).players,
          selection: cloneAlignment({ ...draft, schema: 'AlignmentDocumentV1' }).selection,
        },
      },
      metadata: {
        ...draft.metadata,
        documentVersion: draft.metadata.documentVersion + 1,
        updatedAt: closedAt,
        updatedBy: options.closedBy,
      },
      audit: {
        events: [
          ...draft.audit.events,
          { at: closedAt, by: options.closedBy, kind: 'ALIGNMENT_CLOSED' },
          { at: closedAt, by: options.closedBy, kind: 'LIFECYCLE_TRANSITION', payload: { to: 'CLOSED' } },
        ],
      },
    }

    await this.atomicReplaceAlignment(key, closed, { expectedDocumentVersion: options.expectedDocumentVersion + 1 })

    // índice: solo primer CLOSED del documento (closeRevision===1)
    if (closeRev === 1) {
      await this.tryUpdateIndexOnFirstClose(key, closed)
    }

    return closed
  }

  async reopenAlignment(
    key: AlignmentDocumentKey,
    closed: AlignmentDocumentV1,
    options: { readonly expectedDocumentVersion: number; readonly reopenedBy: string; readonly reason: string },
  ): Promise<AlignmentDocumentV1> {
    if (closed.metadata.documentVersion !== options.expectedDocumentVersion) {
      throw new ActaPersistenceError('DOCUMENT_VERSION_CONFLICT', 'Versión esperada != documentVersion del documento')
    }

    const at = this.opts.now()
    const reopened: AlignmentDocumentV1 = {
      ...closed,
      lifecycle: {
        state: 'REOPENED',
        history: [
          ...closed.lifecycle.history,
          { from: 'CLOSED', to: 'REOPENED', at, by: options.reopenedBy, reason: options.reason },
        ],
      },
      metadata: {
        ...closed.metadata,
        documentVersion: closed.metadata.documentVersion + 1,
        updatedAt: at,
        updatedBy: options.reopenedBy,
      },
      audit: {
        events: [
          ...closed.audit.events,
          { at, by: options.reopenedBy, kind: 'ALIGNMENT_REOPENED', reason: options.reason },
          { at, by: options.reopenedBy, kind: 'LIFECYCLE_TRANSITION', payload: { to: 'REOPENED' } },
        ],
      },
    }

    await this.atomicReplaceAlignment(key, reopened, { expectedDocumentVersion: options.expectedDocumentVersion + 1 })
    return reopened
  }

  async rebuildAlignmentIndex(now: string): Promise<AlignmentIndexV1> {
    const files = await this.store.readAllFilesForDiagnostics?.()
    if (!files) {
      throw new ActaPersistenceError('IO_FAILURE', 'Store no soporta rebuild index (falta listado de ficheros)')
    }

    const byTeamId: Record<string, AlignmentIndexEntryV1> = {}

    for (const [name, entry] of files.entries()) {
      if (!name.endsWith('.json') || name.includes('.json.')) continue
      if (name === `${ALIGNMENT_INDEX_DOCUMENT_NAME}.json`) continue
      try {
        const raw = JSON.parse(entry.content) as AlignmentDocumentV1
        if (raw?.schema !== 'AlignmentDocumentV1') continue
        if (raw.lifecycle.state !== 'CLOSED') continue
        if (!raw.closure) continue
        // solo primer cierre: closeRevision===1
        if (raw.closure.closeRevision !== 1) continue
        const teamId = raw.identity.teamId
        const candidate: AlignmentIndexEntryV1 = {
          storageKey: raw.identity.storageKey,
          documentName: raw.identity.documentFileName.replace(/\.json$/, ''),
          matchId: raw.identity.matchId,
          firstClosedAt: raw.closure.closedAt,
          closeRevision: raw.closure.closeRevision,
        }
        const current = byTeamId[teamId]
        if (!current || Date.parse(candidate.firstClosedAt) > Date.parse(current.firstClosedAt)) {
          byTeamId[teamId] = candidate
        }
      } catch {
        // ignore corrupt files in rebuild; they will be handled separately by probe/load.
      }
    }

    const index: AlignmentIndexV1 = {
      schema: 'AlignmentIndexV1',
      createdAt: now,
      updatedAt: now,
      byTeamId,
    }

    await this.store.atomicReplaceIndexRaw?.(JSON.stringify(index))
    return index
  }

  private async loadByDocumentName(
    documentName: string,
    keyHint: AlignmentDocumentKey,
  ): Promise<AlignmentDocumentV1 | null> {
    // Best-effort: para stores que no soportan lectura directa por nombre, usamos readCommitted (solo si coincide).
    const loaded = await this.store.readCommitted(keyHint)
    if (loaded?.identity.documentFileName.replace(/\.json$/, '') === documentName) return loaded
    // En FakeDrive usaremos listFiles+readOfficial por nombre.
    const files = await this.store.readAllFilesForDiagnostics?.()
    if (!files) return null
    return readOfficialAlignmentFromMap(files, documentName)
  }

  private validateBeforeCommit(doc: AlignmentDocumentV1, key: AlignmentDocumentKey): void {
    const result = validateAlignmentDocument(doc, {
      expectedMatchId: key.matchId,
    })
    if (!result.ok) {
      const messages = result.issues
        .filter((i) => i.severity === 'error')
        .map((i) => i.message)
        .join('; ')
      this.log.error('alignment.validate.fail', { storageKey: key.storageKey, messages })
      throw new ActaPersistenceError('VALIDATION_FAILED', messages || 'Alignment inválido')
    }
  }

  private async atomicReplaceAlignment(
    key: AlignmentDocumentKey,
    doc: AlignmentDocumentV1,
    options: { readonly expectedDocumentVersion: number | undefined },
  ): Promise<void> {
    this.validateBeforeCommit(doc, key)

    // A3 optimistic locking: si caller aporta expected, validamos contra versión COMMIT actual.
    if (options.expectedDocumentVersion != null) {
      const committed = await this.store.readCommitted(key)
      const committedVersion = committed?.metadata.documentVersion ?? 0
      if (committedVersion !== options.expectedDocumentVersion - 1) {
        throw new ActaPersistenceError(
          'DOCUMENT_VERSION_CONFLICT',
          `Optimistic locking: expected base=${options.expectedDocumentVersion - 1} pero committed=${committedVersion}`,
        )
      }
    }
    await this.store.atomicReplace(key, doc)
  }

  private async readIndexSafe(): Promise<AlignmentIndexV1 | null> {
    const raw = (await this.store.readIndexRaw?.()) ?? null
    if (!raw) {
      const files = await this.store.readAllFilesForDiagnostics?.()
      if (!files) return null
      const inMap = readIndexFromMap(files)
      if (!inMap) return null
      return this.normalizeIndex(inMap)
    }
    return this.normalizeIndex(raw)
  }

  private normalizeIndex(raw: unknown): AlignmentIndexV1 | null {
    if (!raw || typeof raw !== 'object') return null
    const rec = raw as Record<string, unknown>
    if (rec.schema !== 'AlignmentIndexV1') return null
    return raw as AlignmentIndexV1
  }

  private async tryUpdateIndexOnFirstClose(
    key: AlignmentDocumentKey,
    closed: AlignmentDocumentV1,
  ): Promise<void> {
    const files = await this.store.readAllFilesForDiagnostics?.()
    const now = this.opts.now()

    let current: AlignmentIndexV1 | null = null
    if (this.store.readIndexRaw) {
      current = this.normalizeIndex(await this.store.readIndexRaw())
    } else if (files) {
      current = this.normalizeIndex(readIndexFromMap(files))
    }

    const byTeamId = { ...(current?.byTeamId ?? {}) }
    const existing = byTeamId[key.teamId]
    const candidate: AlignmentIndexEntryV1 = {
      storageKey: closed.identity.storageKey,
      documentName: closed.identity.documentFileName.replace(/\.json$/, ''),
      matchId: closed.identity.matchId,
      firstClosedAt: closed.closure!.closedAt,
      closeRevision: closed.closure!.closeRevision,
    }

    if (!existing || Date.parse(candidate.firstClosedAt) > Date.parse(existing.firstClosedAt)) {
      byTeamId[key.teamId] = candidate
      const nextIndex: AlignmentIndexV1 = {
        schema: 'AlignmentIndexV1',
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        byTeamId,
      }
      await this.store.atomicReplaceIndexRaw?.(JSON.stringify(nextIndex))
    }
  }
}

/**
 * FakeDrive store para tests unitarios/integración (sin GAS).
 * Vive aquí para que la repo sea usable out-of-the-box en tests.
 */
export class FakeDriveAlignmentDocumentStore implements AlignmentDocumentStore {
  private readonly files: DriveFileMap = new Map()
  private readonly storageKeyIndex = new Map<string, string>()
  private failNextAtomic = false

  getFiles(): DriveFileMap {
    return this.files
  }

  simulateAtomicReplaceFailure(): void {
    this.failNextAtomic = true
  }

  injectRawDocument(documentName: string, doc: AlignmentDocumentV1): void {
    const json = serializeAlignmentDocument(doc)
    atomicReplaceAlignmentInMap(this.files, documentName, json)
    this.storageKeyIndex.set(doc.identity.storageKey, documentName)
  }

  injectCorruptOfficial(storageKey: string, documentName: string, rawContent: string): void {
    this.files.set(`${documentName}.json`, { content: rawContent })
    this.storageKeyIndex.set(storageKey, documentName)
  }

  async probeDocumentState(key: AlignmentDocumentKey): Promise<AlignmentProbeState> {
    const indexed = this.storageKeyIndex.get(key.storageKey)
    if (indexed) {
      const doc = readOfficialAlignmentFromMap(this.files, indexed)
      if (!doc) return 'corrupt'
      const validation = validateAlignmentDocument(doc, { expectedMatchId: key.matchId })
      return validation.ok ? 'valid' : 'corrupt'
    }
    const found = findAlignmentByStorageKeyInMap(this.files, key.storageKey)
    if (!found) return 'absent'
    const validation = validateAlignmentDocument(found.doc, { expectedMatchId: key.matchId })
    return validation.ok ? 'valid' : 'corrupt'
  }

  async hasEntry(key: AlignmentDocumentKey): Promise<boolean> {
    if (this.storageKeyIndex.has(key.storageKey)) return true
    return findAlignmentByStorageKeyInMap(this.files, key.storageKey) != null
  }

  async readCommitted(key: AlignmentDocumentKey): Promise<AlignmentDocumentV1 | null> {
    const indexed = this.storageKeyIndex.get(key.storageKey)
    if (indexed) return readOfficialAlignmentFromMap(this.files, indexed)
    const found = findAlignmentByStorageKeyInMap(this.files, key.storageKey)
    return found?.doc ?? null
  }

  async atomicReplace(key: AlignmentDocumentKey, document: AlignmentDocumentV1): Promise<void> {
    if (this.failNextAtomic) {
      this.failNextAtomic = false
      throw new ActaPersistenceError('IO_FAILURE', 'Simulación de fallo en atomic replace')
    }
    const documentName = buildAlignmentDocumentName(key.teamCode, key.phaseCode, key.encounterCode)
    const json = serializeAlignmentDocument(document)
    const result = atomicReplaceAlignmentInMap(this.files, documentName, json)
    if (!result.ok) {
      throw new ActaPersistenceError(result.code ?? 'IO_FAILURE', result.message ?? 'atomic replace fallido')
    }
    this.storageKeyIndex.set(key.storageKey, documentName)
  }

  async readAllFilesForDiagnostics(): Promise<DriveFileMap> {
    return this.files
  }

  async readIndexRaw(): Promise<unknown | null> {
    return readIndexFromMap(this.files)
  }

  async atomicReplaceIndexRaw(rawIndexJson: string): Promise<void> {
    const result = atomicReplaceAlignmentInMap(this.files, ALIGNMENT_INDEX_DOCUMENT_NAME, rawIndexJson)
    if (!result.ok) {
      throw new ActaPersistenceError(result.code ?? 'IO_FAILURE', result.message ?? 'atomic replace index fallido')
    }
  }
}

