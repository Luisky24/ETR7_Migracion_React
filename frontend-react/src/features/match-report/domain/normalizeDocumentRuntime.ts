/**
 * A4.2 — Pipeline único de normalización documental runtime.
 * Workspace → refs → snapshots CLOSED → MatchReportDocumentRuntimeState
 */

import type { EncounterWorkspaceLoadResult } from '../contracts/encounterWorkspaceLoad.contract'
import type {
  AlignmentSnapshotProjection,
  MatchReportDocumentRuntimeState,
  RuntimeStaleState,
} from '../types/matchReportDocumentRuntime.types'
import type { TeamAlignmentDocumentV1 } from '@/shared/contracts/encounter-workspace.document'
import { computeRuntimeReconcile } from '../tools/runtimeReconcileDiagnostics'
import type { RuntimeReconcileFinding } from '../tools/runtimeReconcileDiagnostics.contract'

const STALE_FINDING_CODES: ReadonlySet<RuntimeReconcileFinding> = new Set([
  'ALIGNMENT_STALE_SNAPSHOT',
  'ALIGNMENT_CLOSE_REVISION_MISMATCH',
  'ALIGNMENT_DOCUMENT_VERSION_MISMATCH',
  'WORKSPACE_ALIGNMENT_REF_MISSING',
  'WORKSPACE_ALIGNMENT_SNAPSHOT_MISSING',
  'WORKSPACE_ALIGNMENT_LIFECYCLE_INVALID',
  'WORKSPACE_GATE_MISMATCH',
])

function projectAlignmentSide(team: TeamAlignmentDocumentV1): AlignmentSnapshotProjection {
  const ref = team.alignmentRef
  return {
    side: team.side,
    storageKey: ref?.storageKey ?? null,
    documentVersion: ref?.documentVersion ?? null,
    closeRevision: ref?.closeRevision ?? null,
    lifecycle: ref?.lifecycle ?? null,
    snapshotPlayerCount: ref?.snapshot?.players.length ?? 0,
    teamEstado: team.estado,
    teamVersion: team.version,
  }
}

function buildStaleState(
  reconcile: ReturnType<typeof computeRuntimeReconcile>,
): RuntimeStaleState {
  const kinds = reconcile.staleGraph.staleCandidates.filter((c) => STALE_FINDING_CODES.has(c))
  return {
    isStale: kinds.length > 0,
    kinds,
    findings: reconcile.findings,
    staleGraph: reconcile.staleGraph,
  }
}

/**
 * Normaliza el resultado de carga Workspace al estado documental runtime oficial.
 * Calcula reconcile findings una sola vez en hydrate.
 */
export function normalizeDocumentRuntimeFromWorkspaceLoad(
  result: EncounterWorkspaceLoadResult,
): MatchReportDocumentRuntimeState {
  const { workspace } = result

  const reconcileResult = computeRuntimeReconcile({
    workspace,
    runtime: {
      actaBinding: workspace.workflow.actaBinding,
      workspaceVersion: result.workspaceVersion,
    },
  })

  const stale = buildStaleState(reconcileResult)
  const actaBinding = workspace.workflow.actaBinding

  return {
    matchId: workspace.identity.matchId,
    metadata: {
      workspaceVersion: result.workspaceVersion,
      actaBinding,
      actaLifecycle: result.lifecycle,
      loadSource: result.source,
      workspacePhase: workspace.lifecycle.phase,
      alignmentGate: workspace.alignments.gate,
      actaDocumentVersion: result.document?.metadata.documentVersion ?? null,
    },
    projections: {
      local: projectAlignmentSide(workspace.alignments.local),
      visitante: projectAlignmentSide(workspace.alignments.visitante),
      acta: {
        fromActaSnapshot: result.report.fromActaSnapshot,
        cerrada: result.report.cerrada,
      },
    },
    stale,
    superseded: {
      isSuperseded: actaBinding === 'SUPERSEDED',
      actaBinding,
    },
    reconcile: {
      ok: reconcileResult.ok,
      findingCodes: reconcileResult.findings.map((f) => f.code),
    },
  }
}

export { getDocumentRuntimeWorkspace } from './documentRuntimeStore'
