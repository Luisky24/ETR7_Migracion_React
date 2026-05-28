/**
 * A4.1.2 — Reconcile documental runtime (read-only).
 * Deriva findings solo desde Workspace hidratado + alignment refs + snapshot metadata.
 * NO carga AlignmentDocument completo.
 */

import type { AlignmentSnapshotV1 } from '@/shared/contracts/alignment.document'
import type {
  AlignmentGate,
  EncounterWorkspaceDocumentV1,
  TeamAlignmentDocumentV1,
  WorkspaceTeamSide,
} from '@/shared/contracts/encounter-workspace.document'
import type {
  RuntimeAlignmentRefDiagnostic,
  RuntimeAlignmentRefsDump,
  RuntimeReconcileBindingSummary,
  RuntimeReconcileFinding,
  RuntimeReconcileFindingRecord,
  RuntimeReconcileLifecycleSummary,
  RuntimeReconcileResult,
  RuntimeReconcileVersions,
  RuntimeStaleGraph,
  RuntimeStaleGraphSide,
  RuntimeStaleStateDump,
} from './runtimeReconcileDiagnostics.contract'

export type {
  RuntimeActaLifecycleDump,
  RuntimeAlignmentRefDiagnostic,
  RuntimeAlignmentRefsDump,
  RuntimeReconcileBindingSummary,
  RuntimeReconcileFinding,
  RuntimeReconcileFindingRecord,
  RuntimeReconcileLifecycleSummary,
  RuntimeReconcileResult,
  RuntimeReconcileVersions,
  RuntimeStaleGraph,
  RuntimeStaleStateDump,
} from './runtimeReconcileDiagnostics.contract'

export interface RuntimeReconcileInput {
  readonly workspace: EncounterWorkspaceDocumentV1
  readonly runtime?: {
    readonly actaBinding?: 'ACTIVE' | 'SUPERSEDED' | null
    readonly workspaceVersion?: number | null
    readonly recovery?: unknown
  }
}

function playersMaterializationKey(
  players: readonly {
    readonly playerId: string
    readonly dorsal: number
    readonly titular: boolean
    readonly suplente: boolean
    readonly capitan?: boolean
  }[],
): string {
  return [...players]
    .map(
      (p) =>
        `${p.playerId}:${p.dorsal}:${p.titular ? 1 : 0}:${p.suplente ? 1 : 0}:${p.capitan ? 1 : 0}`,
    )
    .sort()
    .join('|')
}

function snapshotMaterializationKey(snapshot: AlignmentSnapshotV1): string {
  const starterSet = new Set(snapshot.selection.starters)
  const benchSet = new Set(snapshot.selection.bench)
  const captain = snapshot.selection.captain ?? ''
  const flags = snapshot.players.map((p) => ({
    playerId: p.playerId,
    dorsal: p.dorsal,
    titular: starterSet.has(p.playerId),
    suplente: benchSet.has(p.playerId),
    capitan: p.playerId === captain,
  })) as readonly {
    playerId: string
    dorsal: number
    titular: boolean
    suplente: boolean
    capitan: boolean
  }[]
  return playersMaterializationKey(flags)
}

function expectedGateFromTeams(
  local: TeamAlignmentDocumentV1,
  visitante: TeamAlignmentDocumentV1,
): AlignmentGate {
  if (local.estado === 'C' && visitante.estado === 'C') return 'both_closed'
  if (local.estado === '' && visitante.estado === '') return 'not_started'
  return 'in_progress'
}

function isClosedTeam(team: TeamAlignmentDocumentV1): boolean {
  return team.estado === 'C'
}

function snapshotMissing(ref: TeamAlignmentDocumentV1['alignmentRef'], team: TeamAlignmentDocumentV1): boolean {
  if (!ref) return false
  if (!ref.snapshot) return true
  if (ref.snapshot.players.length === 0 && team.players.length > 0) return true
  return false
}

function snapshotStale(ref: TeamAlignmentDocumentV1['alignmentRef'], team: TeamAlignmentDocumentV1): boolean {
  if (!ref?.snapshot || !isClosedTeam(team)) return false
  if (team.players.length === 0) return false
  return playersMaterializationKey(team.players) !== snapshotMaterializationKey(ref.snapshot)
}

function analyzeSide(
  side: WorkspaceTeamSide,
  team: TeamAlignmentDocumentV1,
  actaBinding: EncounterWorkspaceDocumentV1['workflow']['actaBinding'],
): { readonly findings: RuntimeReconcileFindingRecord[]; readonly staleFlags: RuntimeReconcileFinding[] } {
  const findings: RuntimeReconcileFindingRecord[] = []
  const staleFlags: RuntimeReconcileFinding[] = []
  const ref = team.alignmentRef

  const push = (code: RuntimeReconcileFinding, message: string, details?: RuntimeReconcileFindingRecord['details']) => {
    findings.push({ code, message, side, details })
    if (!staleFlags.includes(code)) staleFlags.push(code)
  }

  if (isClosedTeam(team) && !ref) {
    push('WORKSPACE_ALIGNMENT_REF_MISSING', 'Equipo cerrado sin alignmentRef en Workspace')
  }

  if (ref && snapshotMissing(ref, team)) {
    push('WORKSPACE_ALIGNMENT_SNAPSHOT_MISSING', 'alignmentRef sin snapshot consumible')
  }

  if (ref && team.version > 0 && ref.documentVersion !== team.version) {
    push(
      'ALIGNMENT_DOCUMENT_VERSION_MISMATCH',
      'documentVersion del ref no coincide con team.version materializado',
      { refDocumentVersion: ref.documentVersion, teamVersion: team.version },
    )
  }

  if (ref && isClosedTeam(team) && ref.lifecycle !== 'CLOSED') {
    push(
      'WORKSPACE_ALIGNMENT_LIFECYCLE_INVALID',
      `lifecycle del ref (${ref.lifecycle}) incompatible con equipo cerrado`,
      { refLifecycle: ref.lifecycle },
    )
  }

  if (ref && snapshotStale(ref, team)) {
    push('ALIGNMENT_STALE_SNAPSHOT', 'Snapshot del ref no coincide con players materializados en Workspace')
    if (ref.closeRevision > 0) {
      push(
        'ALIGNMENT_CLOSE_REVISION_MISMATCH',
        'Posible drift de closeRevision (heurística ref-only: players ≠ snapshot)',
        { closeRevision: ref.closeRevision },
      )
    }
  }

  if (actaBinding === 'SUPERSEDED' || ref?.lifecycle === 'REOPENED') {
    if (!staleFlags.includes('WORKSPACE_SUPERSEDED')) staleFlags.push('WORKSPACE_SUPERSEDED')
  }

  return { findings, staleFlags }
}

function buildRefDiagnostic(
  side: WorkspaceTeamSide,
  team: TeamAlignmentDocumentV1,
  actaBinding: EncounterWorkspaceDocumentV1['workflow']['actaBinding'],
  sideFindings: readonly RuntimeReconcileFindingRecord[],
): RuntimeAlignmentRefDiagnostic {
  const ref = team.alignmentRef
  const staleFlags = sideFindings.map((f) => f.code)
  return {
    side,
    storageKey: ref?.storageKey ?? null,
    documentVersion: ref?.documentVersion ?? null,
    closeRevision: ref?.closeRevision ?? null,
    lifecycle: ref?.lifecycle ?? null,
    closedAt: ref?.closedAt ?? null,
    snapshotMeta: ref?.snapshot
      ? {
          playerCount: ref.snapshot.players.length,
          hasSelection:
            ref.snapshot.selection.starters.length > 0 ||
            ref.snapshot.selection.bench.length > 0 ||
            Boolean(ref.snapshot.selection.captain),
        }
      : null,
    staleFlags,
    supersededCandidate: actaBinding === 'SUPERSEDED' || ref?.lifecycle === 'REOPENED',
    teamEstado: team.estado,
    teamVersion: team.version,
    teamPlayerCount: team.players.length,
  }
}

function buildStaleGraphSide(
  side: WorkspaceTeamSide,
  team: TeamAlignmentDocumentV1,
  staleFlags: readonly RuntimeReconcileFinding[],
): RuntimeStaleGraphSide {
  const ref = team.alignmentRef
  return {
    side,
    teamVersion: team.version,
    teamEstado: team.estado,
    ref: ref
      ? {
          storageKey: ref.storageKey,
          documentVersion: ref.documentVersion,
          closeRevision: ref.closeRevision,
          lifecycle: ref.lifecycle,
        }
      : null,
    staleCandidates: staleFlags,
  }
}

export function computeRuntimeReconcile(input: RuntimeReconcileInput): RuntimeReconcileResult {
  const { workspace, runtime } = input
  const findings: RuntimeReconcileFindingRecord[] = []

  const expectedGate = expectedGateFromTeams(workspace.alignments.local, workspace.alignments.visitante)
  if (workspace.alignments.gate !== expectedGate) {
    findings.push({
      code: 'WORKSPACE_GATE_MISMATCH',
      message: `gate=${workspace.alignments.gate} pero esperado=${expectedGate}`,
      details: { gate: workspace.alignments.gate, expectedGate },
    })
  }

  if (workspace.workflow.actaBinding === 'SUPERSEDED') {
    findings.push({
      code: 'WORKSPACE_SUPERSEDED',
      message: 'Encounter Workspace marcado SUPERSEDED',
    })
  }

  const localAnalysis = analyzeSide('local', workspace.alignments.local, workspace.workflow.actaBinding)
  const visitanteAnalysis = analyzeSide(
    'visitante',
    workspace.alignments.visitante,
    workspace.workflow.actaBinding,
  )
  findings.push(...localAnalysis.findings, ...visitanteAnalysis.findings)

  const allCodes = findings.map((f) => f.code)
  const staleCandidates = [...new Set(allCodes)]

  const refs: RuntimeAlignmentRefDiagnostic[] = [
    buildRefDiagnostic('local', workspace.alignments.local, workspace.workflow.actaBinding, localAnalysis.findings),
    buildRefDiagnostic(
      'visitante',
      workspace.alignments.visitante,
      workspace.workflow.actaBinding,
      visitanteAnalysis.findings,
    ),
  ]

  const versions: RuntimeReconcileVersions = {
    workspaceVersion: workspace.metadata.workspaceVersion,
    stateWorkspaceVersion: runtime?.workspaceVersion ?? null,
    local: {
      teamVersion: workspace.alignments.local.version,
      refDocumentVersion: workspace.alignments.local.alignmentRef?.documentVersion ?? null,
      refCloseRevision: workspace.alignments.local.alignmentRef?.closeRevision ?? null,
    },
    visitante: {
      teamVersion: workspace.alignments.visitante.version,
      refDocumentVersion: workspace.alignments.visitante.alignmentRef?.documentVersion ?? null,
      refCloseRevision: workspace.alignments.visitante.alignmentRef?.closeRevision ?? null,
    },
  }

  const staleGraph: RuntimeStaleGraph = {
    matchId: workspace.identity.matchId,
    workspaceVersion: workspace.metadata.workspaceVersion,
    actaBinding: workspace.workflow.actaBinding,
    gate: workspace.alignments.gate,
    local: buildStaleGraphSide('local', workspace.alignments.local, localAnalysis.staleFlags),
    visitante: buildStaleGraphSide(
      'visitante',
      workspace.alignments.visitante,
      visitanteAnalysis.staleFlags,
    ),
    staleCandidates,
  }

  const lifecycle: RuntimeReconcileLifecycleSummary = {
    workspacePhase: workspace.lifecycle.phase,
    gate: workspace.alignments.gate,
    expectedGate,
    localEstado: workspace.alignments.local.estado,
    visitanteEstado: workspace.alignments.visitante.estado,
    reconcileFindingCodes: staleCandidates,
  }

  const binding: RuntimeReconcileBindingSummary = {
    workspaceActaBinding: workspace.workflow.actaBinding,
    stateActaBinding: runtime?.actaBinding ?? null,
    bindingMismatch:
      runtime?.actaBinding != null && runtime.actaBinding !== workspace.workflow.actaBinding,
  }

  return {
    ok: findings.length === 0,
    matchId: workspace.identity.matchId,
    findings,
    refs,
    versions,
    staleGraph,
    lifecycle,
    binding,
  }
}

export function buildAlignmentRefsDump(
  workspace: EncounterWorkspaceDocumentV1,
  runtime?: RuntimeReconcileInput['runtime'],
): RuntimeAlignmentRefsDump {
  const reconcile = computeRuntimeReconcile({ workspace, runtime })
  return {
    matchId: workspace.identity.matchId,
    workspaceVersion: workspace.metadata.workspaceVersion,
    actaBinding: workspace.workflow.actaBinding,
    gate: workspace.alignments.gate,
    refs: reconcile.refs,
    findings: reconcile.findings,
    staleGraph: reconcile.staleGraph,
  }
}

export function buildStaleStateDump(
  workspace: EncounterWorkspaceDocumentV1,
  runtime?: RuntimeReconcileInput['runtime'] & {
    readonly recovery?: unknown
    readonly operationError?: { readonly code: string } | null
  },
): RuntimeStaleStateDump {
  const reconcile = computeRuntimeReconcile({ workspace, runtime })
  return {
    matchId: workspace.identity.matchId,
    actaBinding: runtime?.actaBinding ?? workspace.workflow.actaBinding,
    workspaceVersion: runtime?.workspaceVersion ?? workspace.metadata.workspaceVersion,
    recovery: runtime?.recovery ?? null,
    operationError: runtime?.operationError ?? null,
    staleGraph: reconcile.staleGraph,
    findings: reconcile.findings,
  }
}
