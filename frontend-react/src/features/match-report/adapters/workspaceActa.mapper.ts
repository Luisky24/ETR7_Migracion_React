/**
 * Mapper explícito ActaDocumentV1 ⇄ EncounterWorkspaceDocumentV1 / workspace.acta.
 * Sin I/O ni runtime React.
 */

import type { ActaDocumentV1, ActaDocumentMetadata, ActaMatchKey } from '../contracts/actaDocument'
import type { EncounterWorkflowLastReopen } from '../contracts/encounterWorkflow.contract'
import type {
  EncounterWorkspaceDocumentV1,
  WorkspaceActaSectionV1,
  WorkspaceMatchCategory,
  WorkspaceMatchPhase,
  WorkspaceMutationKind,
} from '@/shared/contracts/encounter-workspace.document'
import { deriveAlignmentGate, deriveWorkspaceLifecyclePhase } from '@/shared/contracts/validateEncounterWorkspaceDocument'
import type { MatchReport, PlayerMatchStatsWire } from '../contracts'

export function buildWorkspaceDocumentFileName(
  phase: WorkspaceMatchPhase,
  encounterNumber: number,
): string {
  const phaseToken = phase === 'Fase II' ? 'Fase2' : 'Fase1'
  return `ENC_WS_${phaseToken}_Encuentro${encounterNumber}`
}

export interface CreateEncounterWorkspaceInput {
  readonly key: ActaMatchKey
  readonly encounterNumber: number
  readonly grupo: string
  readonly equipoLocal: string
  readonly equipoVisitante: string
  readonly hora: string
  readonly campo: string
  readonly referenciaEncuentro?: string
  readonly createdBy: string
  readonly calendarBookHint?: string
  readonly calendarRowHint?: number
}

export function createEncounterWorkspace(input: CreateEncounterWorkspaceInput): EncounterWorkspaceDocumentV1 {
  const now = new Date().toISOString()
  const storageKey = `${input.key.category}::${input.key.phase}::${input.key.matchId}`
  const documentFileName = buildWorkspaceDocumentFileName(input.key.phase, input.encounterNumber)

  const workspace: EncounterWorkspaceDocumentV1 = {
    identity: {
      matchId: input.key.matchId,
      category: input.key.category as WorkspaceMatchCategory,
      phase: input.key.phase as WorkspaceMatchPhase,
      encounter: {
        grupo: input.grupo,
        equipoLocal: input.equipoLocal,
        equipoVisitante: input.equipoVisitante,
        hora: input.hora,
        campo: input.campo,
        encounterNumber: input.encounterNumber,
        referenciaEncuentro: input.referenciaEncuentro,
      },
      storageKey,
      documentFileName,
    },
    metadata: {
      schemaVersion: 1,
      workspaceVersion: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
      lastMutationBy: input.createdBy,
      lastMutationKind: 'WORKSPACE_CREATE',
    },
    lifecycle: {
      phase: 'workspace_created',
      phaseChangedAt: now,
      phaseChangedBy: input.createdBy,
    },
    workflow: {
      actaBinding: 'ACTIVE',
    },
    calendarRef: {
      rowKey: {
        grupo: input.grupo,
        equipoLocal: input.equipoLocal,
        equipoVisitante: input.equipoVisitante,
        referenciaEncuentro: input.referenciaEncuentro,
      },
      calendarBookHint: input.calendarBookHint,
      calendarRowHint: input.calendarRowHint,
    },
    alignments: {
      schemaVersion: 1,
      gate: 'not_started',
      local: emptyAlignmentTeam('local', input.equipoLocal),
      visitante: emptyAlignmentTeam('visitante', input.equipoVisitante),
    },
    officials: {},
    acta: null,
    sync: { ledger: [] },
    audit: {
      events: [
        {
          at: now,
          by: input.createdBy,
          kind: 'WORKSPACE_CREATE',
          workspaceVersion: 1,
        },
      ],
    },
  }

  return withDerivedLifecycle(workspace)
}

export function createEncounterWorkspaceFromActaDocument(
  acta: ActaDocumentV1,
  savedBy: string,
): EncounterWorkspaceDocumentV1 {
  const enc = acta.match.encounter
  const shell = createEncounterWorkspace({
    key: {
      category: acta.match.category,
      phase: acta.match.phase,
      matchId: acta.match.matchId,
    },
    encounterNumber: enc.encounterNumber,
    grupo: enc.grupo,
    equipoLocal: enc.equipoLocal,
    equipoVisitante: enc.equipoVisitante,
    hora: enc.hora,
    campo: enc.campo,
    referenciaEncuentro: acta.match.referenciaEncuentro,
    createdBy: savedBy,
  })
  return mergeActaIntoWorkspace(shell, acta, {
    mutationKind: 'FIRST_ACTA_MATERIALIZE',
    savedBy,
    isCreate: true,
  })
}

export function mergeActaIntoWorkspace(
  workspace: EncounterWorkspaceDocumentV1,
  acta: ActaDocumentV1,
  patch: {
    readonly savedBy: string
    readonly mutationKind: WorkspaceMutationKind
    readonly isCreate?: boolean
  },
): EncounterWorkspaceDocumentV1 {
  const section = actaSectionFromActaDocument(acta)
  const workflow = workflowFromActaMetadata(acta.metadata)
  const now = acta.metadata.updatedAt || new Date().toISOString()
  const officials = {} as EncounterWorkspaceDocumentV1['officials']

  const merged: EncounterWorkspaceDocumentV1 = {
    ...workspace,
    workflow: {
      ...workspace.workflow,
      ...workflow,
    },
    officials,
    acta: section,
    metadata: {
      ...workspace.metadata,
      updatedAt: now,
      lastMutationBy: patch.savedBy,
      lastMutationKind: patch.mutationKind,
    },
  }

  return withDerivedLifecycle(merged)
}

export function applyWorkspaceVersionCommit(
  workspace: EncounterWorkspaceDocumentV1,
  nextVersion: number,
  patch: {
    readonly savedBy: string
    readonly mutationKind: WorkspaceMutationKind
    readonly auditKind: EncounterWorkspaceDocumentV1['audit']['events'][number]['kind']
  },
): EncounterWorkspaceDocumentV1 {
  const now = new Date().toISOString()
  const withVersion: EncounterWorkspaceDocumentV1 = {
    ...workspace,
    metadata: {
      ...workspace.metadata,
      workspaceVersion: nextVersion,
      updatedAt: now,
      lastMutationBy: patch.savedBy,
      lastMutationKind: patch.mutationKind,
    },
    audit: {
      events: appendAuditEvent(workspace, {
        at: now,
        by: patch.savedBy,
        kind: patch.auditKind,
        workspaceVersion: nextVersion,
      }),
    },
  }
  return withDerivedLifecycle(withVersion)
}

export function actaDocumentV1FromWorkspace(
  workspace: EncounterWorkspaceDocumentV1,
): ActaDocumentV1 | null {
  if (!workspace.acta) return null
  const a = workspace.acta
  const wf = workspace.workflow

  const metadata: ActaDocumentMetadata = {
    schemaVersion: 1,
    documentVersion: workspace.metadata.workspaceVersion,
    status: a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    createdBy: a.createdBy,
    lastSavedBy: a.lastSavedBy,
    closedAt: a.closedAt,
    closedBy: a.closedBy,
    reopenedAt: a.reopenedAt,
    reopenedBy: a.reopenedBy,
    reopenReason: a.reopenReason,
    encounterWorkflow: {
      actaBinding: wf.actaBinding,
      lastReopen: mapLastReopenToActa(wf.lastReopen),
    },
  }

  return {
    metadata,
    match: {
      matchId: workspace.identity.matchId,
      documentName: workspace.identity.documentFileName,
      category: workspace.identity.category,
      phase: workspace.identity.phase,
      encounter: { ...workspace.identity.encounter },
      referenciaEncuentro: workspace.identity.encounter.referenciaEncuentro,
    },
    localTeam: {
      side: 'local',
      equipo: a.localTeam.equipo,
      delegado: a.localTeam.delegado,
      entrenador: a.localTeam.entrenador,
      players: a.localTeam.players.map((p) => ({
        jugador: p.jugador,
        dorsal: p.dorsal,
        E: p.E,
        T: p.T,
        PC: p.PC,
        Tar: p.Tar,
      })),
      totals: a.localTeam.totals,
      observaciones: a.localTeam.observaciones,
    },
    awayTeam: {
      side: 'visitante',
      equipo: a.awayTeam.equipo,
      delegado: a.awayTeam.delegado,
      entrenador: a.awayTeam.entrenador,
      players: a.awayTeam.players.map((p) => ({
        jugador: p.jugador,
        dorsal: p.dorsal,
        E: p.E,
        T: p.T,
        PC: p.PC,
        Tar: p.Tar,
      })),
      totals: a.awayTeam.totals,
      observaciones: a.awayTeam.observaciones,
    },
    scoring: {
      score: { ...a.score },
      incidencias: a.incidencias,
    },
    referee: a.referee ? { referee: a.referee } : {},
    observations: {
      incidencias: a.incidencias,
      observacionesLocal: a.observacionesLocal,
      observacionesVisitante: a.observacionesVisitante,
    },
    classification: { ...a.classification },
  }
}

export function legacyActaDocumentToWorkspace(acta: ActaDocumentV1): EncounterWorkspaceDocumentV1 {
  return createEncounterWorkspaceFromActaDocument(acta, acta.metadata.lastSavedBy ?? 'migration')
}

export function createEncounterWorkspaceInputFromReport(
  report: MatchReport,
  encounterNumber: number,
): CreateEncounterWorkspaceInput {
  const ctx = report.context
  return {
    key: {
      category: ctx.category,
      phase: ctx.phase,
      matchId: ctx.encuentroId,
    },
    encounterNumber,
    grupo: ctx.grupo,
    equipoLocal: ctx.equipoLocal,
    equipoVisitante: ctx.equipoVisitante,
    hora: ctx.hora,
    campo: ctx.campo,
    referenciaEncuentro: ctx.referenciaEncuentro || undefined,
    createdBy: 'etr7-runtime',
  }
}

function wirePlayerToWorkspace(p: PlayerMatchStatsWire): WorkspaceActaSectionV1['localTeam']['players'][number] {
  const dorsal = typeof p.dorsal === 'number' ? p.dorsal : parseInt(String(p.dorsal), 10) || 0
  return {
    jugador: String(p.jugador ?? ''),
    dorsal,
    E: p.E,
    T: p.T,
    PC: p.PC,
    Tar: p.Tar,
  }
}

function actaSectionFromActaDocument(acta: ActaDocumentV1): WorkspaceActaSectionV1 {
  return {
    sectionRevision: acta.metadata.documentVersion,
    status: acta.metadata.status,
    createdAt: acta.metadata.createdAt,
    updatedAt: acta.metadata.updatedAt,
    createdBy: acta.metadata.createdBy,
    lastSavedBy: acta.metadata.lastSavedBy,
    closedAt: acta.metadata.closedAt,
    closedBy: acta.metadata.closedBy,
    reopenedAt: acta.metadata.reopenedAt,
    reopenedBy: acta.metadata.reopenedBy,
    reopenReason: acta.metadata.reopenReason,
    localTeam: {
      ...acta.localTeam,
      players: acta.localTeam.players.map(wirePlayerToWorkspace),
    },
    awayTeam: {
      ...acta.awayTeam,
      players: acta.awayTeam.players.map(wirePlayerToWorkspace),
    },
    score: { ...acta.scoring.score },
    incidencias: acta.scoring.incidencias,
    referee: acta.referee.referee,
    observacionesLocal: acta.observations.observacionesLocal,
    observacionesVisitante: acta.observations.observacionesVisitante,
    classification: { ...acta.classification },
  }
}

function workflowFromActaMetadata(metadata: ActaDocumentMetadata): EncounterWorkspaceDocumentV1['workflow'] {
  const ew = metadata.encounterWorkflow
  return {
    actaBinding: ew?.actaBinding ?? 'ACTIVE',
    lastReopen: mapLastReopenFromActa(ew?.lastReopen),
  }
}

function mapLastReopenFromActa(
  lr: EncounterWorkflowLastReopen | undefined,
): EncounterWorkspaceDocumentV1['workflow']['lastReopen'] {
  if (!lr) return undefined
  return {
    mode: lr.mode,
    at: lr.at,
    by: lr.by,
    reason: lr.reason,
    alcance: lr.alcance,
    fromWorkspaceVersion: lr.fromDocumentVersion,
  }
}

function mapLastReopenToActa(
  lr: EncounterWorkspaceDocumentV1['workflow']['lastReopen'],
): EncounterWorkflowLastReopen | undefined {
  if (!lr) return undefined
  return {
    mode: lr.mode,
    at: lr.at,
    by: lr.by,
    reason: lr.reason,
    alcance: lr.alcance,
    fromDocumentVersion: lr.fromWorkspaceVersion,
  }
}

function emptyAlignmentTeam(
  side: 'local' | 'visitante',
  equipo: string,
): EncounterWorkspaceDocumentV1['alignments']['local'] {
  return {
    side,
    equipo,
    estado: '',
    delegado: '',
    entrenador: '',
    players: [],
    version: 0,
  }
}

/** Alineaciones coherentes con acta cerrada (WS-34) antes de validar/commit. */
export function normalizeAlignmentsForWorkspaceCommit(
  workspace: EncounterWorkspaceDocumentV1,
): EncounterWorkspaceDocumentV1 {
  if (workspace.acta?.status !== 'ACTA_CERRADA') {
    return withDerivedLifecycle(workspace)
  }
  return withDerivedLifecycle({
    ...workspace,
    alignments: {
      ...workspace.alignments,
      gate: 'both_closed',
      local: { ...workspace.alignments.local, estado: 'C' },
      visitante: { ...workspace.alignments.visitante, estado: 'C' },
    },
  })
}

function withDerivedLifecycle(workspace: EncounterWorkspaceDocumentV1): EncounterWorkspaceDocumentV1 {
  const gate = deriveAlignmentGate(workspace.alignments)
  const phase = deriveWorkspaceLifecyclePhase(workspace)
  return {
    ...workspace,
    alignments: {
      ...workspace.alignments,
      gate,
    },
    lifecycle: {
      ...workspace.lifecycle,
      phase,
      phaseChangedAt: workspace.metadata.updatedAt,
      phaseChangedBy: workspace.metadata.lastMutationBy,
    },
  }
}

function appendAuditEvent(
  workspace: EncounterWorkspaceDocumentV1,
  event: EncounterWorkspaceDocumentV1['audit']['events'][number],
): EncounterWorkspaceDocumentV1['audit']['events'] {
  return [...workspace.audit.events, event]
}
