/**
 * Contrato documental oficial del agregado Alineaciones (ETR7).
 * Fase A2: tipos + constantes + helpers puros. Sin acoplamiento a runtime React ni persistencia.
 */

export const ALIGNMENT_DOCUMENT_SCHEMA_VERSION = 1 as const

export type AlignmentLifecycleState = 'DRAFT' | 'IN_PROGRESS' | 'CLOSED' | 'REOPENED'

export type AlignmentAuditKind =
  | 'ALIGNMENT_CREATE'
  | 'ALIGNMENT_BOOTSTRAP'
  | 'ALIGNMENT_EDIT'
  | 'LIFECYCLE_TRANSITION'
  | 'ALIGNMENT_CLOSED'
  | 'ALIGNMENT_REOPENED'

export type AlignmentBootstrapSource = 'SHEETS' | 'PREVIOUS_ALIGNMENT' | 'MANUAL'

export type AlignmentRoleInMatch = 'LOCAL' | 'VISITANTE'

export interface AlignmentIdentityV1 {
  /** Identidad natural (estable dentro del repositorio de categoría/temporada). */
  readonly categoryId: string
  readonly seasonId: string
  readonly teamId: string
  readonly matchId: string
  readonly phaseId: string
  readonly encounterId: string
  /**
   * Identidad persistente estable para refs Workspace/Acta y reconcile.
   * Debe ser independiente de `documentFileName`.
   *
   * Recomendación de formato (en validator): `${categoryId}::${seasonId}::${teamId}::${phaseId}::${encounterId}::${matchId}`
   */
  readonly storageKey: string
  /** Naming oficial: `ALI_{equipo}_{fase}_{encuentro}.json` */
  readonly documentFileName: string
}

export interface AlignmentMetadataV1 {
  readonly schemaVersion: typeof ALIGNMENT_DOCUMENT_SCHEMA_VERSION
  /**
   * Concurrencia de persistencia (optimistic locking).
   * Independiente de closeRevision. Monotónico por commit persistido. Inicia en 1.
   */
  readonly documentVersion: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly createdBy: string
  readonly updatedBy: string
}

export interface AlignmentTeamV1 {
  readonly teamId: string
  readonly teamCode: string
  readonly roleInMatch: AlignmentRoleInMatch
}

export interface AlignmentMatchV1 {
  readonly phaseId: string
  readonly phaseCode: string
  readonly encounterId: string
  readonly encounterCode: string
  readonly matchId: string
}

export interface AlignmentPlayerV1 {
  readonly playerId: string
  readonly displayName: string
  /** Dorsal materializado en el documento (runtime no consulta Sheets). */
  readonly dorsal: number
  readonly position?: string
}

export interface AlignmentSelectionV1 {
  readonly starters: readonly string[]
  readonly bench: readonly string[]
  readonly captain: string | null
  readonly goalkeeper: string | null
}

export interface AlignmentLifecycleTransitionV1 {
  readonly from: AlignmentLifecycleState
  readonly to: AlignmentLifecycleState
  readonly at: string
  readonly by: string
  /** Obligatorio para transiciones que reabren (ver invariantes ALI-07). */
  readonly reason?: string
  readonly correlationId?: string
}

export interface AlignmentLifecycleV1 {
  readonly state: AlignmentLifecycleState
  /** Append-only (ver invariantes ALI-10). */
  readonly history: readonly AlignmentLifecycleTransitionV1[]
}

export interface AlignmentSnapshotV1 {
  readonly players: readonly AlignmentPlayerV1[]
  readonly selection: AlignmentSelectionV1
  readonly computed?: Readonly<Record<string, string | number | boolean>>
}

export interface AlignmentClosureV1 {
  readonly closedAt: string
  readonly closedBy: string
  /** Revisión monotónica obligatoria (1,2,3...). */
  readonly closeRevision: number
  /** Snapshot oficial consumible por Acta/Workspace. */
  readonly snapshot: AlignmentSnapshotV1
}

export interface AlignmentAuditEventV1 {
  readonly at: string
  readonly by: string
  readonly kind: AlignmentAuditKind
  /** Payload no estructurado (evitar acoplamiento premature). */
  readonly payload?: Readonly<Record<string, string | number | boolean>>
  /** Reason tipado para eventos relevantes (p.ej. REOPEN). */
  readonly reason?: string
}

export interface AlignmentAuditV1 {
  /** Append-only estricto (ver invariantes ALI-09). */
  readonly events: readonly AlignmentAuditEventV1[]
}

export interface AlignmentBootstrapV1 {
  readonly source: AlignmentBootstrapSource
  readonly sourceRef?: string
  readonly bootstrappedAt: string
}

export interface AlignmentSyncV1 {
  readonly bootstrap?: AlignmentBootstrapV1
}

export interface AlignmentIntegrityV1 {
  readonly contentHash?: string
  readonly lastWriterInstanceId?: string
}

/**
 * Agregado documental único por (team + phase + encounter) (1 JSON = 1 alineación).
 */
export interface AlignmentDocumentV1 {
  readonly schema: 'AlignmentDocumentV1'
  readonly identity: AlignmentIdentityV1
  readonly metadata: AlignmentMetadataV1
  readonly team: AlignmentTeamV1
  readonly match: AlignmentMatchV1
  /** Roster materializado: runtime prohibido consultar Sheets tras creación. */
  readonly players: readonly AlignmentPlayerV1[]
  readonly selection: AlignmentSelectionV1
  readonly lifecycle: AlignmentLifecycleV1
  /** Presente si ha sido cerrado al menos una vez; requerido si lifecycle.state === CLOSED. */
  readonly closure?: AlignmentClosureV1
  readonly audit: AlignmentAuditV1
  readonly sync: AlignmentSyncV1
  readonly integrity?: AlignmentIntegrityV1
}

