/**
 * Contrato documental oficial del agregado Encounter Workspace (ETR7).
 * Fase 1: tipos + constantes. Sin acoplamiento a runtime React ni persistencia acta actual.
 */

// AlignmentDocument integration (A3.5): refs + snapshots consumibles (Workspace no edita alineaciones).
import type { AlignmentLifecycleState, AlignmentSnapshotV1 } from './alignment.document'

export const ENCOUNTER_WORKSPACE_SCHEMA_VERSION = 1 as const
export const ALIGNMENTS_SECTION_SCHEMA_VERSION = 1 as const

/** Máximo de entradas en sync.ledger (WS-35). */
export const SYNC_LEDGER_MAX_ENTRIES = 100
/** Máximo de eventos en audit.events. */
export const AUDIT_EVENTS_MAX_ENTRIES = 50

export type WorkspaceMatchCategory = 'M' | 'F'
export type WorkspaceMatchPhase = 'Fase I' | 'Fase II'

export type WorkspaceLifecyclePhase =
  | 'workspace_created'
  | 'alignment_in_progress'
  | 'alignment_complete'
  | 'acta_in_progress'
  | 'acta_closed'

/** Vinculación operativa de la sección acta (antes actaBinding en acta metadata). */
export type WorkspaceActaBinding = 'ACTIVE' | 'SUPERSEDED'

export type AlignmentGate = 'not_started' | 'in_progress' | 'both_closed'

export type AlignmentTeamEstado = '' | 'P' | 'C'

export type WorkspaceActaStatus = 'ACTA_EN_CURSO' | 'ACTA_CERRADA'

export type WorkspaceTeamSide = 'local' | 'visitante'

export type CalendarSyncIntent =
  | 'close'
  | 'reopen_acta'
  | 'reopen_alignments'
  | 'alignment_complete'

export type CalendarSyncStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export type ReopenMode = 'REOPEN_ACTA' | 'REOPEN_ALIGNMENTS'

export type ReopenAlcance = 'L' | 'V' | 'A'

export type WorkspaceAuditKind =
  | 'WORKSPACE_CREATE'
  | 'LIFECYCLE_TRANSITION'
  | 'WORKFLOW_BINDING_CHANGE'
  | 'ACTA_MATERIALIZED'
  | 'ACTA_SAVED'
  | 'ACTA_CLOSED'
  | 'ACTA_REOPENED'
  | 'ALIGNMENTS_REOPENED'
  | 'ALIGNMENT_ACCEPTED'
  | 'CALENDAR_SYNC_SCHEDULED'
  | 'CALENDAR_SYNC_RESULT'
  | 'ENCOUNTER_IDENTITY_CORRECTED'

/**
 * PROHIBIDO en schema v1 (WS-40): ACTA_NEW_REVISION y revisiones paralelas.
 * No existe en WorkspaceAuditKind ni en comandos de dominio v1.
 */

export type WorkspaceMutationKind =
  | 'WORKSPACE_CREATE'
  | 'ALIGNMENT_UPSERT'
  | 'ALIGNMENT_CLOSE_SIDE'
  | 'ALIGNMENT_ACCEPT'
  | 'FIRST_ACTA_MATERIALIZE'
  | 'ACTA_SAVE_DRAFT'
  | 'ACTA_CLOSE'
  | 'REOPEN_ACTA'
  | 'REOPEN_ALIGNMENTS'
  | 'CALENDAR_SYNC_RESULT'
  | 'ADMIN_PATCH'

export interface EncounterSnapshotV1 {
  readonly grupo: string
  readonly equipoLocal: string
  readonly equipoVisitante: string
  readonly hora: string
  readonly campo: string
  readonly encounterNumber: number
  readonly referenciaEncuentro?: string
  readonly scheduledAt?: string
}

export interface WorkspaceIdentityV1 {
  readonly matchId: string
  readonly category: WorkspaceMatchCategory
  readonly phase: WorkspaceMatchPhase
  readonly encounter: EncounterSnapshotV1
  readonly storageKey: string
  readonly documentFileName: string
}

export interface WorkspaceMetadataV1 {
  readonly schemaVersion: typeof ENCOUNTER_WORKSPACE_SCHEMA_VERSION
  readonly workspaceVersion: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly createdBy: string
  readonly lastMutationBy: string
  readonly lastMutationKind: WorkspaceMutationKind
}

export interface WorkspaceLifecycleV1 {
  readonly phase: WorkspaceLifecyclePhase
  readonly phaseChangedAt: string
  readonly phaseChangedBy: string
}

export interface WorkflowAlignmentAcceptanceV1 {
  readonly acceptedAt: string
  readonly acceptedBy: string
}

export interface WorkflowLastReopenV1 {
  readonly mode: ReopenMode
  readonly at: string
  readonly by: string
  readonly fromWorkspaceVersion: number
  readonly reason?: string
  readonly alcance?: ReopenAlcance
}

export interface WorkspaceWorkflowV1 {
  readonly actaBinding: WorkspaceActaBinding
  readonly alignmentAcceptance?: WorkflowAlignmentAcceptanceV1
  readonly lastReopen?: WorkflowLastReopenV1
}

export interface CalendarEncounterRowKeyV1 {
  readonly grupo: string
  readonly equipoLocal: string
  readonly equipoVisitante: string
  readonly referenciaEncuentro?: string
}

export interface WorkspaceCalendarRefV1 {
  readonly rowKey: CalendarEncounterRowKeyV1
  /** Informativo; no autoritativo para sync (WS-32). */
  readonly calendarBookHint?: string
  readonly calendarRowHint?: number
}

/** Pre-acta únicamente: vacío o ausente tras materializar acta (WS-36). */
export interface WorkspaceOfficialsPreActaV1 {
  readonly referee?: {
    readonly name: string
    readonly assignedAt?: string
  }
}

export interface AlignmentPlayerV1 {
  readonly playerId: string
  readonly jugador: string
  readonly dorsal: number
  readonly titular: boolean
  readonly suplente: boolean
  readonly capitan: boolean
}

export interface TeamAlignmentDocumentV1 {
  readonly side: WorkspaceTeamSide
  readonly equipo: string
  readonly estado: AlignmentTeamEstado
  readonly delegado: string
  readonly entrenador: string
  readonly players: readonly AlignmentPlayerV1[]
  readonly closedAt?: string
  readonly closedBy?: string
  readonly version: number
  /**
   * Ref documental a AlignmentDocumentV1 (source of truth) + snapshot cerrado consumible.
   * Workspace NO posee alineaciones: solo agrega para hidratación/reconcile.
   */
  readonly alignmentRef?: WorkspaceAlignmentRefV1
}

export interface WorkspaceAlignmentRefV1 {
  readonly storageKey: string
  readonly documentVersion: number
  readonly closeRevision: number
  readonly lifecycle: AlignmentLifecycleState
  readonly closedAt: string
  readonly closedBy: string
  readonly snapshot: AlignmentSnapshotV1
}

export interface WorkspaceAlignmentsSectionV1 {
  readonly schemaVersion: typeof ALIGNMENTS_SECTION_SCHEMA_VERSION
  readonly gate: AlignmentGate
  readonly local: TeamAlignmentDocumentV1
  readonly visitante: TeamAlignmentDocumentV1
}

export interface WorkspaceActaRefereeV1 {
  readonly name: string
}

export interface WorkspaceActaPlayerWireV1 {
  readonly jugador: string
  readonly dorsal: number
  readonly E: number
  readonly T: number
  readonly PC: number
  readonly Tar: number
}

export interface WorkspaceActaTeamTotalsV1 {
  readonly E: number
  readonly T: number
  readonly PC: number
  readonly Tar: number
}

export interface WorkspaceActaTeamDocumentV1 {
  readonly side: WorkspaceTeamSide
  readonly equipo: string
  readonly delegado: string
  readonly entrenador: string
  readonly players: readonly WorkspaceActaPlayerWireV1[]
  readonly totals: WorkspaceActaTeamTotalsV1
  readonly observaciones: string
}

export interface WorkspaceActaScoreV1 {
  readonly local: number
  readonly visitante: number
}

export interface WorkspaceActaClassificationV1 {
  readonly P: number
  readonly BO: number
  readonly BD: number
  readonly Total: number
}

export interface WorkspaceActaClassificationOfficialV1 {
  readonly local: WorkspaceActaClassificationV1
  readonly visitante: WorkspaceActaClassificationV1
  readonly source: 'server'
  readonly appliedAt: string
}

export interface WorkspaceActaClassificationDocumentV1 {
  readonly local: WorkspaceActaClassificationV1
  readonly visitante: WorkspaceActaClassificationV1
  readonly official?: WorkspaceActaClassificationOfficialV1
}

/**
 * Única acta operacional embebida (WS-5, WS-40).
 * PROHIBIDO: acta[], ACTA_NEW_REVISION, revisiones paralelas.
 */
export interface WorkspaceActaSectionV1 {
  readonly sectionRevision: number
  readonly status: WorkspaceActaStatus
  readonly createdAt: string
  readonly updatedAt: string
  readonly createdBy?: string
  readonly lastSavedBy?: string
  readonly closedAt?: string
  readonly closedBy?: string
  readonly reopenedAt?: string
  readonly reopenedBy?: string
  readonly reopenReason?: string
  readonly localTeam: WorkspaceActaTeamDocumentV1
  readonly awayTeam: WorkspaceActaTeamDocumentV1
  readonly score: WorkspaceActaScoreV1
  readonly incidencias: string
  readonly referee?: WorkspaceActaRefereeV1
  readonly observacionesLocal: string
  readonly observacionesVisitante: string
  readonly classification: WorkspaceActaClassificationDocumentV1
}

export interface CalendarSyncKeyV1 {
  readonly matchId: string
  readonly workspaceVersion: number
  readonly intent: CalendarSyncIntent
}

export interface CalendarSyncLedgerEntryV1 {
  readonly syncKey: CalendarSyncKeyV1
  readonly syncKeyString: string
  readonly intent: CalendarSyncIntent
  readonly status: CalendarSyncStatus
  readonly retries: number
  readonly lastError?: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface WorkspaceSyncLastResultV1 {
  readonly syncKeyString: string
  readonly intent: CalendarSyncIntent
  readonly at: string
  readonly workspaceVersion: number
}

export interface WorkspaceSyncSectionV1 {
  readonly ledger: readonly CalendarSyncLedgerEntryV1[]
  readonly lastSuccessful?: WorkspaceSyncLastResultV1
  readonly lastFailed?: WorkspaceSyncLastResultV1 & { readonly error: string }
}

export interface WorkspaceAuditEventV1 {
  readonly at: string
  readonly by: string
  readonly kind: WorkspaceAuditKind
  readonly workspaceVersion: number
  readonly payload?: Readonly<Record<string, string | number | boolean>>
}

export interface WorkspaceAuditSectionV1 {
  readonly events: readonly WorkspaceAuditEventV1[]
}

/**
 * Agregado documental único por encuentro (1 JSON = 1 workspace).
 */
export interface EncounterWorkspaceDocumentV1 {
  readonly identity: WorkspaceIdentityV1
  readonly metadata: WorkspaceMetadataV1
  readonly lifecycle: WorkspaceLifecycleV1
  readonly workflow: WorkspaceWorkflowV1
  readonly calendarRef: WorkspaceCalendarRefV1
  readonly alignments: WorkspaceAlignmentsSectionV1
  /** Pre-acta only; debe estar vacío si acta !== null. */
  readonly officials: WorkspaceOfficialsPreActaV1
  /** null = sin acta materializada; única acta operacional si presente. */
  readonly acta: WorkspaceActaSectionV1 | null
  readonly sync: WorkspaceSyncSectionV1
  readonly audit: WorkspaceAuditSectionV1
}
