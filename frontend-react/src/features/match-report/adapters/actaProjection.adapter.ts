/**
 * Proyección dominio UI → documento JSON (`ActaDocumentV1`).
 * Sin I/O. La metadata de persistencia (versiones, timestamps) la aporta el caller/repositorio.
 */

import type { ActaDocumentV1, ActaDocumentMetadata, MatchIdentity } from '../contracts/actaDocument'
import type { MatchReport, PlayerMatchStatsWire, TeamSide } from '../contracts'
export interface ProjectActaDocumentInput {
  readonly metadata: ActaDocumentMetadata
  readonly report: MatchReport
  readonly encounterNumber: number
  readonly documentName: string
}

function playerToWire(
  p: MatchReport['local']['players'][number],
): PlayerMatchStatsWire {
  return {
    jugador: p.jugador,
    dorsal: p.dorsal,
    E: p.actions.E,
    T: p.actions.T,
    PC: p.actions.PC,
    Tar: p.actions.Tar,
  }
}

function buildTeamDocument(
  team: MatchReport['local'],
  side: TeamSide,
): ActaDocumentV1['localTeam'] {
  return {
    side,
    equipo: team.equipo,
    delegado: team.delegado,
    entrenador: team.entrenador,
    players: team.players.map(playerToWire),
    totals: team.totals,
    observaciones: team.observaciones,
  }
}

function buildMatchIdentity(input: ProjectActaDocumentInput): MatchIdentity {
  const { report, encounterNumber, documentName } = input
  const ctx = report.context
  return {
    matchId: ctx.encuentroId,
    documentName,
    category: ctx.category,
    phase: ctx.phase,
    encounter: {
      grupo: ctx.grupo,
      equipoLocal: ctx.equipoLocal,
      equipoVisitante: ctx.equipoVisitante,
      hora: ctx.hora,
      campo: ctx.campo,
      encounterNumber,
    },
    referenciaEncuentro: ctx.referenciaEncuentro || undefined,
  }
}

/**
 * Construye `ActaDocumentV1` desde `MatchReport` y metadata ya resuelta por persistencia.
 *
 * TODO(infra): tras close exitoso, fusionar `classification.official` desde `MatchClosureResult`.
 * TODO(infra): derivar `closePolicy` desde política de finalize del dominio.
 */
export function projectMatchReportToActaDocument(input: ProjectActaDocumentInput): ActaDocumentV1 {
  const { metadata, report } = input

  return {
    metadata,
    match: buildMatchIdentity(input),
    localTeam: buildTeamDocument(report.local, 'local'),
    awayTeam: buildTeamDocument(report.visitante, 'visitante'),
    scoring: {
      score: report.score,
      incidencias: report.incidencias,
    },
    referee: { referee: report.referee },
    observations: {
      incidencias: report.incidencias,
      observacionesLocal: report.local.observaciones,
      observacionesVisitante: report.visitante.observaciones,
    },
    classification: {
      local: report.local.classification,
      visitante: report.visitante.classification,
    },
  }
}

/** Naming físico acordado: `ACT_{Fase}_{EncuentroN}` (sin extensión). */
export function buildActaDocumentName(phaseLabel: MatchReport['context']['phase'], encounterNumber: number): string {
  const phaseToken = phaseLabel === 'Fase II' ? 'Fase2' : 'Fase1'
  return `ACT_${phaseToken}_Encuentro${encounterNumber}`
}
