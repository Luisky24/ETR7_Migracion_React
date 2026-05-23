import type { MatchCategory, MatchPhaseLabel } from '../matchReport.contract'
import type { ActaDocumentV1 } from './actaDocument.contract'
import type { ActaLifecycleState } from './actaLifecycle.contract'

export interface ActaMatchKey {
  readonly category: MatchCategory
  readonly phase: MatchPhaseLabel
  readonly matchId: string
}

export interface ActaSaveOptions {
  /** Requerido en updates; omitido en primer save (`NO_EXISTE` → create). */
  readonly expectedDocumentVersion?: number
  readonly savedBy?: string
  readonly intent: 'draft' | 'close'
}

export type ActaPersistenceErrorCode =
  | 'DOCUMENT_VERSION_CONFLICT'
  | 'VALIDATION_FAILED'
  | 'IO_FAILURE'
  | 'CORRUPT_DOCUMENT'
  | 'LIFECYCLE_VIOLATION'
  | 'ALREADY_EXISTS'

export type ActaSaveResult =
  | { readonly ok: true; readonly documentVersion: number }
  | { readonly ok: false; readonly code: ActaPersistenceErrorCode; readonly message?: string }

/** Repositorio de persistencia JSON (sin implementación en esta fase). */
export interface ActaRepository {
  resolveLifecycle(key: ActaMatchKey): Promise<ActaLifecycleState>
  load(key: ActaMatchKey): Promise<ActaDocumentV1 | null>
  save(document: ActaDocumentV1, options: ActaSaveOptions): Promise<ActaSaveResult>
}

export interface ReopenAuditPayload {
  readonly reopenedBy: string
  readonly reopenReason?: string
}

/** Reapertura admin (Staff/LCV) — orquestada desde Calendario, no desde Acta UI. */
export interface ActaAdminRepository {
  reopen(key: ActaMatchKey, audit: ReopenAuditPayload): Promise<ActaDocumentV1>
}
