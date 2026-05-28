import type { ActaLifecycleState } from '../contracts/actaDocument'
import type { EncounterWorkspaceLoadSource } from '../contracts/encounterWorkspaceLoad.contract'
import type {
  RuntimeReconcileFinding,
  RuntimeReconcileFindingRecord,
  RuntimeStaleGraph,
} from '../tools/runtimeReconcileDiagnostics.contract'
import type { AlignmentLifecycleState } from '@/shared/contracts/alignment.document'
import type {
  AlignmentGate,
  AlignmentTeamEstado,
  WorkspaceActaBinding,
  WorkspaceLifecyclePhase,
  WorkspaceTeamSide,
} from '@/shared/contracts/encounter-workspace.document'

/** Metadatos documentales reflejados (no lifecycle paralelo derivado). */
export interface MatchReportDocumentMetadata {
  readonly workspaceVersion: number
  readonly actaBinding: WorkspaceActaBinding
  /** Reflejo de `EncounterWorkspaceLoadResult.lifecycle` (documento). */
  readonly actaLifecycle: ActaLifecycleState
  readonly loadSource: EncounterWorkspaceLoadSource
  readonly workspacePhase: WorkspaceLifecyclePhase
  readonly alignmentGate: AlignmentGate
  /** Versión acta JSON cuando existe proyección `document`. */
  readonly actaDocumentVersion: number | null
}

/** Proyección ligera de snapshot CLOSED / ref (sin AlignmentDocument completo). */
export interface AlignmentSnapshotProjection {
  readonly side: WorkspaceTeamSide
  readonly storageKey: string | null
  readonly documentVersion: number | null
  readonly closeRevision: number | null
  readonly lifecycle: AlignmentLifecycleState | null
  readonly snapshotPlayerCount: number
  readonly teamEstado: AlignmentTeamEstado
  readonly teamVersion: number
}

export interface ActaDocumentProjection {
  readonly fromActaSnapshot: boolean
  readonly cerrada: boolean
}

/** Stale unificado runtime (findings + flags UX). */
export interface RuntimeStaleState {
  readonly isStale: boolean
  readonly kinds: readonly RuntimeReconcileFinding[]
  readonly findings: readonly RuntimeReconcileFindingRecord[]
  readonly staleGraph: RuntimeStaleGraph
}

export interface RuntimeSupersededState {
  readonly isSuperseded: boolean
  readonly actaBinding: WorkspaceActaBinding
}

export interface RuntimeReconcileProjection {
  readonly ok: boolean
  readonly findingCodes: readonly RuntimeReconcileFinding[]
}

/**
 * A4.2 — Estado documental runtime oficial (proyección Workspace + refs + reconcile).
 * Sin lifecycle paralelo, sin players reconstruidos, sin bootstrap legacy.
 */
export interface MatchReportDocumentRuntimeState {
  readonly matchId: string
  readonly metadata: MatchReportDocumentMetadata
  readonly projections: {
    readonly local: AlignmentSnapshotProjection
    readonly visitante: AlignmentSnapshotProjection
    readonly acta: ActaDocumentProjection
  }
  readonly stale: RuntimeStaleState
  readonly superseded: RuntimeSupersededState
  readonly reconcile: RuntimeReconcileProjection
}
