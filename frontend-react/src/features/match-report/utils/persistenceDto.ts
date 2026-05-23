import type { MatchPersistenceDTO, MatchReport, PlayerMatchStatsWire } from '../contracts'

function toWirePlayers(report: MatchReport, side: 'local' | 'visitante'): PlayerMatchStatsWire[] {
  const team = side === 'local' ? report.local : report.visitante
  return team.players
    .filter((p) => p.isTitularOrSuplente)
    .map((p) => ({
      jugador: p.jugador,
      dorsal: p.dorsal,
      E: p.actions.E,
      T: p.actions.T,
      PC: p.actions.PC,
      Tar: p.actions.Tar,
    }))
}

/** Construye DTO de persistencia desde informe (sin arrays encuentro). */
export function buildMatchPersistenceDto(report: MatchReport, cerrar: boolean): MatchPersistenceDTO {
  const { context } = report
  return {
    categoria: context.category,
    fase: context.phase,
    idEncuentro: context.encuentroId,
    referencia_encuentro: context.referenciaEncuentro || undefined,
    resultadoLocal: report.score.local,
    resultadoVisitante: report.score.visitante,
    incidencias: report.incidencias,
    referee: report.referee,
    observacionesLocal: report.local.observaciones,
    observacionesVisitante: report.visitante.observaciones,
    arrResultadoLocal: toWirePlayers(report, 'local'),
    arrResultadoVisitante: toWirePlayers(report, 'visitante'),
    arrTotalesLocal: report.local.totals,
    arrTotalesVisitante: report.visitante.totals,
    arrPuntosConseguidosLocal: report.local.classification,
    arrPuntosConseguidosVisitante: report.visitante.classification,
    cerrar,
  }
}
