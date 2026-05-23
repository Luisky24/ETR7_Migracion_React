/**
 * Hidratación documento JSON → `MatchReport` (runtime React).
 * Sin I/O. No recalcula classification si `ACTA_CERRADA` (freeze F14).
 */

import type { ActaDocumentV1 } from '../contracts/actaDocument'
import type {
  MatchContext,
  MatchReport,
  MatchStatus,
  PlayerMatchLine,
  PlayerMatchStatsWire,
} from '../contracts'
import { deriveEditability } from '../domain'
import { buildPlayerId } from '../utils/playerRowKeys'

export interface HydrateActaDocumentOptions {
  /**
   * Contexto de navegación (Calendario). Si se omite, se deriva del documento.
   * `matchStatus` se alinea con metadata del acta.
   */
  readonly context?: MatchContext
}

function wireToPlayerLine(p: PlayerMatchStatsWire): PlayerMatchLine {
  const dorsal = typeof p.dorsal === 'number' ? p.dorsal : parseInt(String(p.dorsal), 10) || 0
  const jugador = String(p.jugador ?? '').trim()
  return {
    playerId: buildPlayerId(dorsal, jugador),
    jugador,
    dorsal,
    isTitularOrSuplente: true,
    isCaptain: false,
    actions: { E: p.E, T: p.T, PC: p.PC, Tar: p.Tar },
  }
}

function matchStatusFromDocument(status: ActaDocumentV1['metadata']['status']): MatchStatus {
  return status === 'ACTA_CERRADA' ? 'acta_cerrada' : 'acta_abierta'
}

function buildContextFromDocument(doc: ActaDocumentV1, override?: MatchContext): MatchContext {
  if (override) {
    return {
      ...override,
      matchStatus: matchStatusFromDocument(doc.metadata.status),
      encuentroId: doc.match.matchId,
    }
  }
  const enc = doc.match.encounter
  const resultadoDisplay = `${doc.scoring.score.local} - ${doc.scoring.score.visitante}`
  return {
    category: doc.match.category,
    phase: doc.match.phase,
    encuentroId: doc.match.matchId,
    grupo: enc.grupo,
    equipoLocal: enc.equipoLocal,
    equipoVisitante: enc.equipoVisitante,
    hora: enc.hora,
    campo: enc.campo,
    resultadoDisplay,
    estadoAlineacionesDisplay: 'C - C',
    matchStatus: matchStatusFromDocument(doc.metadata.status),
    referenciaEncuentro: doc.match.referenciaEncuentro ?? '',
  }
}

function teamFromDocument(team: ActaDocumentV1['localTeam']): MatchReport['local'] {
  return {
    side: team.side,
    equipo: team.equipo,
    delegado: team.delegado,
    entrenador: team.entrenador,
    players: team.players.map(wireToPlayerLine),
    totals: team.totals,
    classification: { P: 0, BO: 0, BD: 0, Total: 0 },
    observaciones: team.observaciones,
  }
}

/**
 * Hidrata `MatchReport` desde `ActaDocumentV1`.
 *
 * - `ACTA_CERRADA`: classification del JSON tal cual (freeze; sin recálculo).
 * - `ACTA_EN_CURSO`: classification persistida tal cual; el dominio recalcula solo al editar en runtime.
 *
 * TODO(infra): validar documento con `validateActaDocument` antes de hidratar.
 * TODO(infra): en reapertura, conservar `closedAt` en metadata y descongelar edición.
 */
export function hydrateMatchReportFromActaDocument(
  doc: ActaDocumentV1,
  options: HydrateActaDocumentOptions = {},
): MatchReport {
  const context = buildContextFromDocument(doc, options.context)
  const cerrada = doc.metadata.status === 'ACTA_CERRADA'
  const fromActaSnapshot = true

  let local = teamFromDocument(doc.localTeam)
  let visitante = teamFromDocument(doc.awayTeam)

  local = { ...local, classification: doc.classification.local }
  visitante = { ...visitante, classification: doc.classification.visitante }

  return {
    context,
    cerrada,
    fromActaSnapshot,
    modoBorrador: !cerrada,
    local,
    visitante,
    score: doc.scoring.score,
    incidencias: doc.observations.incidencias || doc.scoring.incidencias,
    referee: doc.referee.referee,
    editability: deriveEditability(context.matchStatus, cerrada),
  }
}
