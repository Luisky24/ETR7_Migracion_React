import type { AlignmentLifecycleState } from '@/shared/contracts/alignment.document'
import type {
  AlignmentGate,
  AlignmentTeamEstado,
  WorkspaceActaBinding,
  WorkspaceTeamSide,
} from '@/shared/contracts/encounter-workspace.document'

/** Findings oficiales A4.1.2 (solo metadata runtime; sin AlignmentDocument completo). */
export type RuntimeReconcileFinding =
  | 'ALIGNMENT_STALE_SNAPSHOT'
  | 'ALIGNMENT_CLOSE_REVISION_MISMATCH'
  | 'ALIGNMENT_DOCUMENT_VERSION_MISMATCH'
  | 'WORKSPACE_SUPERSEDED'
  | 'WORKSPACE_ALIGNMENT_REF_MISSING'
  | 'WORKSPACE_ALIGNMENT_SNAPSHOT_MISSING'
  | 'WORKSPACE_ALIGNMENT_LIFECYCLE_INVALID'
  | 'WORKSPACE_GATE_MISMATCH'

export interface RuntimeReconcileFindingRecord {
  readonly code: RuntimeReconcileFinding
  readonly message: string
  readonly side?: WorkspaceTeamSide
  readonly details?: Readonly<Record<string, string | number | boolean>>
}

export interface RuntimeAlignmentRefDiagnostic {
  readonly side: WorkspaceTeamSide
  readonly storageKey: string | null
  readonly documentVersion: number | null
  readonly closeRevision: number | null
  readonly lifecycle: AlignmentLifecycleState | null
  readonly closedAt: string | null
  readonly snapshotMeta: {
    readonly playerCount: number
    readonly hasSelection: boolean
  } | null
  readonly staleFlags: readonly RuntimeReconcileFinding[]
  readonly supersededCandidate: boolean
  readonly teamEstado: AlignmentTeamEstado
  readonly teamVersion: number
  readonly teamPlayerCount: number
}

export interface RuntimeStaleGraphSide {
  readonly side: WorkspaceTeamSide
  readonly teamVersion: number
  readonly teamEstado: AlignmentTeamEstado
  readonly ref: {
    readonly storageKey: string
    readonly documentVersion: number
    readonly closeRevision: number
    readonly lifecycle: AlignmentLifecycleState
  } | null
  readonly staleCandidates: readonly RuntimeReconcileFinding[]
}

export interface RuntimeStaleGraph {
  readonly matchId: string
  readonly workspaceVersion: number
  readonly actaBinding: WorkspaceActaBinding
  readonly gate: AlignmentGate
  readonly local: RuntimeStaleGraphSide
  readonly visitante: RuntimeStaleGraphSide
  readonly staleCandidates: readonly RuntimeReconcileFinding[]
}

export interface RuntimeReconcileVersions {
  readonly workspaceVersion: number
  readonly stateWorkspaceVersion: number | null
  readonly local: {
    readonly teamVersion: number
    readonly refDocumentVersion: number | null
    readonly refCloseRevision: number | null
  }
  readonly visitante: {
    readonly teamVersion: number
    readonly refDocumentVersion: number | null
    readonly refCloseRevision: number | null
  }
}

export interface RuntimeReconcileLifecycleSummary {
  readonly workspacePhase: string
  readonly gate: AlignmentGate
  readonly expectedGate: AlignmentGate
  readonly localEstado: AlignmentTeamEstado
  readonly visitanteEstado: AlignmentTeamEstado
  readonly reconcileFindingCodes: readonly RuntimeReconcileFinding[]
}

export interface RuntimeReconcileBindingSummary {
  readonly workspaceActaBinding: WorkspaceActaBinding
  readonly stateActaBinding: WorkspaceActaBinding | null
  readonly bindingMismatch: boolean
}

export interface RuntimeReconcileResult {
  readonly ok: boolean
  readonly matchId: string
  readonly findings: readonly RuntimeReconcileFindingRecord[]
  readonly refs: readonly RuntimeAlignmentRefDiagnostic[]
  readonly versions: RuntimeReconcileVersions
  readonly staleGraph: RuntimeStaleGraph
  readonly lifecycle: RuntimeReconcileLifecycleSummary
  readonly binding: RuntimeReconcileBindingSummary
}

export interface RuntimeActaLifecycleDump {
  readonly matchId: string
  readonly actaBinding: WorkspaceActaBinding | null
  readonly workspaceVersion: number | null
  readonly operation: string
  readonly recovery: unknown
  readonly operationError: { readonly code: string; readonly userMessage: string } | null
  readonly report: {
    readonly cerrada: boolean
    readonly editability: string
    readonly fromActaSnapshot: boolean
    readonly matchStatus: string
  } | null
  readonly reconcile: {
    readonly ok: boolean
    readonly findingCodes: readonly RuntimeReconcileFinding[]
  } | null
  readonly lifecycle: RuntimeReconcileLifecycleSummary | null
}

export interface RuntimeAlignmentRefsDump {
  readonly matchId: string
  readonly workspaceVersion: number
  readonly actaBinding: WorkspaceActaBinding
  readonly gate: AlignmentGate
  readonly refs: readonly RuntimeAlignmentRefDiagnostic[]
  readonly findings: readonly RuntimeReconcileFindingRecord[]
  readonly staleGraph: RuntimeStaleGraph
}

export interface RuntimeStaleStateDump {
  readonly matchId: string
  readonly actaBinding: WorkspaceActaBinding | null
  readonly workspaceVersion: number | null
  readonly recovery: unknown
  readonly operationError: { readonly code: string } | null
  readonly staleGraph: RuntimeStaleGraph | null
  readonly findings: readonly RuntimeReconcileFindingRecord[]
}
