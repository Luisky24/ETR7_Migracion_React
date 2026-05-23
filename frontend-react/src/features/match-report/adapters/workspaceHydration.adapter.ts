/**
 * Hidratación Encounter Workspace → MatchReport (sin I/O).
 */

import type { ActaDocumentV1 } from '../contracts/actaDocument'
import type { ActaLifecycleState } from '../contracts/actaDocument/actaLifecycle.contract'
import type {
  MatchContext,
  MatchReport,
  MatchTeam,
  PlayerMatchLine,
} from '../contracts'
import type {
  AlignmentPlayerV1,
  EncounterWorkspaceDocumentV1,
  TeamAlignmentDocumentV1,
} from '@/shared/contracts/encounter-workspace.document'
import { actaDocumentV1FromWorkspace } from './workspaceActa.mapper'
import { hydrateMatchReportFromActaDocument } from './actaHydration.adapter'
import { deriveEditability } from '../domain'
import { shouldHydrateActaFromWorkspace } from '../utils/encounterWorkflow'
import { ensurePenaltyTryPlayersOnReport } from '../presentation/penaltyTryPlayer'
import { buildPlayerId } from '../utils/playerRowKeys'
import { createPenaltyTryPlayerLine } from '../presentation/penaltyTryPlayer'

export interface HydrateWorkspaceOptions {
  readonly context: MatchContext
}

export function shouldUseActaSectionForHydration(workspace: EncounterWorkspaceDocumentV1): boolean {
  return shouldHydrateActaFromWorkspace(workspace)
}

export function resolveLifecycleFromWorkspace(workspace: EncounterWorkspaceDocumentV1): ActaLifecycleState {
  if (!workspace.acta) return 'NO_EXISTE'
  return workspace.acta.status
}

function alignmentPlayerToLine(player: AlignmentPlayerV1): PlayerMatchLine {
  return {
    playerId: player.playerId || buildPlayerId(player.dorsal, player.jugador),
    jugador: player.jugador,
    dorsal: player.dorsal,
    isTitularOrSuplente: player.titular || player.suplente,
    isCaptain: player.capitan,
    actions: { E: 0, T: 0, PC: 0, Tar: 0 },
  }
}

function teamFromAlignment(
  alignment: TeamAlignmentDocumentV1,
  side: MatchTeam['side'],
): MatchTeam {
  const players = alignment.players.map(alignmentPlayerToLine)
  const withPenalty = [...players, createPenaltyTryPlayerLine()]
  return {
    side,
    equipo: alignment.equipo,
    delegado: alignment.delegado,
    entrenador: alignment.entrenador,
    players: withPenalty,
    totals: { E: 0, T: 0, PC: 0, Tar: 0 },
    classification: { P: 0, BO: 0, BD: 0, Total: 0 },
    observaciones: '',
  }
}

function buildContextForShell(workspace: EncounterWorkspaceDocumentV1, context: MatchContext): MatchContext {
  const enc = workspace.identity.encounter
  return {
    ...context,
    encuentroId: workspace.identity.matchId,
    grupo: enc.grupo,
    equipoLocal: enc.equipoLocal,
    equipoVisitante: enc.equipoVisitante,
    hora: enc.hora,
    campo: enc.campo,
    referenciaEncuentro: enc.referenciaEncuentro ?? context.referenciaEncuentro ?? '',
  }
}

/**
 * Runtime editable desde alineaciones documentales (acta null o SUPERSEDED).
 */
export function hydrateMatchReportFromWorkspaceAlignments(
  workspace: EncounterWorkspaceDocumentV1,
  options: HydrateWorkspaceOptions,
): MatchReport {
  const context = buildContextForShell(workspace, options.context)
  const cerrada = false
  const referee = workspace.officials.referee?.name
    ? { name: workspace.officials.referee.name }
    : undefined

  return {
    context,
    cerrada,
    fromActaSnapshot: false,
    modoBorrador: true,
    local: teamFromAlignment(workspace.alignments.local, 'local'),
    visitante: teamFromAlignment(workspace.alignments.visitante, 'visitante'),
    score: { local: 0, visitante: 0 },
    incidencias: '',
    referee,
    editability: deriveEditability(context.matchStatus, cerrada),
  }
}

/**
 * Orquestador: acta ACTIVE → acta; si no → alineaciones documentales.
 */
export function hydrateMatchReportFromWorkspace(
  workspace: EncounterWorkspaceDocumentV1,
  options: HydrateWorkspaceOptions,
): MatchReport {
  if (shouldUseActaSectionForHydration(workspace) && workspace.acta) {
    const acta = actaDocumentV1FromWorkspace(workspace)
    if (!acta) {
      return hydrateMatchReportFromWorkspaceAlignments(workspace, options)
    }
    const report = hydrateMatchReportFromActaDocument(acta, { context: options.context })
    return ensurePenaltyTryPlayersOnReport(report)
  }
  return ensurePenaltyTryPlayersOnReport(
    hydrateMatchReportFromWorkspaceAlignments(workspace, options),
  )
}

export function actaProjectionFromWorkspace(
  workspace: EncounterWorkspaceDocumentV1,
): ActaDocumentV1 | undefined {
  if (!workspace.acta) return undefined
  return actaDocumentV1FromWorkspace(workspace) ?? undefined
}
