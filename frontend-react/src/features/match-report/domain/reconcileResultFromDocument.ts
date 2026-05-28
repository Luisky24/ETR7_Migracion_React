/**
 * A4.3 — Reconstruye RuntimeReconcileResult desde document + workspace cache (sin recompute ni reload).
 */

import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'
import type { MatchReportDocumentRuntimeState } from '../types/matchReportDocumentRuntime.types'
import type { RuntimeReconcileResult } from '../tools/runtimeReconcileDiagnostics.contract'
import { deriveAlignmentGate } from '@/shared/contracts/validateEncounterWorkspaceDocument'

export function buildRuntimeReconcileResultFromDocument(input: {
  readonly document: MatchReportDocumentRuntimeState
  readonly workspace: EncounterWorkspaceDocumentV1
  readonly runtimeMeta?: {
    readonly actaBinding?: 'ACTIVE' | 'SUPERSEDED' | null
    readonly workspaceVersion?: number | null
  }
}): RuntimeReconcileResult {
  const { document, workspace, runtimeMeta } = input
  const expectedGate = deriveAlignmentGate(workspace.alignments)
  return {
    ok: document.reconcile.ok,
    matchId: document.matchId,
    findings: document.stale.findings,
    refs: [
      {
        side: 'local',
        storageKey: document.projections.local.storageKey,
        documentVersion: document.projections.local.documentVersion,
        closeRevision: document.projections.local.closeRevision,
        lifecycle: document.projections.local.lifecycle,
        closedAt: workspace.alignments.local.alignmentRef?.closedAt ?? null,
        snapshotMeta: document.projections.local.snapshotPlayerCount
          ? {
              playerCount: document.projections.local.snapshotPlayerCount,
              hasSelection: true,
            }
          : null,
        staleFlags: document.stale.kinds,
        supersededCandidate: document.superseded.isSuperseded,
        teamEstado: document.projections.local.teamEstado,
        teamVersion: document.projections.local.teamVersion,
        teamPlayerCount: workspace.alignments.local.players.length,
      },
      {
        side: 'visitante',
        storageKey: document.projections.visitante.storageKey,
        documentVersion: document.projections.visitante.documentVersion,
        closeRevision: document.projections.visitante.closeRevision,
        lifecycle: document.projections.visitante.lifecycle,
        closedAt: workspace.alignments.visitante.alignmentRef?.closedAt ?? null,
        snapshotMeta: document.projections.visitante.snapshotPlayerCount
          ? {
              playerCount: document.projections.visitante.snapshotPlayerCount,
              hasSelection: true,
            }
          : null,
        staleFlags: document.stale.kinds,
        supersededCandidate: document.superseded.isSuperseded,
        teamEstado: document.projections.visitante.teamEstado,
        teamVersion: document.projections.visitante.teamVersion,
        teamPlayerCount: workspace.alignments.visitante.players.length,
      },
    ],
    versions: {
      workspaceVersion: document.metadata.workspaceVersion,
      stateWorkspaceVersion: runtimeMeta?.workspaceVersion ?? null,
      local: {
        teamVersion: document.projections.local.teamVersion,
        refDocumentVersion: document.projections.local.documentVersion,
        refCloseRevision: document.projections.local.closeRevision,
      },
      visitante: {
        teamVersion: document.projections.visitante.teamVersion,
        refDocumentVersion: document.projections.visitante.documentVersion,
        refCloseRevision: document.projections.visitante.closeRevision,
      },
    },
    staleGraph: document.stale.staleGraph,
    lifecycle: {
      workspacePhase: document.metadata.workspacePhase,
      gate: document.metadata.alignmentGate,
      expectedGate,
      localEstado: document.projections.local.teamEstado,
      visitanteEstado: document.projections.visitante.teamEstado,
      reconcileFindingCodes: document.reconcile.findingCodes,
    },
    binding: {
      workspaceActaBinding: document.metadata.actaBinding,
      stateActaBinding: runtimeMeta?.actaBinding ?? null,
      bindingMismatch:
        runtimeMeta?.actaBinding != null &&
        runtimeMeta.actaBinding !== document.metadata.actaBinding,
    },
  }
}
