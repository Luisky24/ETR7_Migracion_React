import type { MatchReport, MatchTeam, PlayerMatchLine } from '../contracts'
import { recalculateMatchReport } from '../domain'
import { buildPlayerId } from '../utils/playerRowKeys'

/** Nombre operativo del jugador ficticio para ensayos de castigo. */
export const PENALTY_TRY_PLAYER_NAME = 'Ensayo castigo'

/** Dorsal reservado (no usado en alineación real). */
export const PENALTY_TRY_DORSAL = 0

export const PENALTY_TRY_PLAYER_ID = buildPlayerId(PENALTY_TRY_DORSAL, PENALTY_TRY_PLAYER_NAME)

export function isPenaltyTryPlayer(playerId: string): boolean {
  return playerId === PENALTY_TRY_PLAYER_ID
}

export function createPenaltyTryPlayerLine(existing?: PlayerMatchLine): PlayerMatchLine {
  return {
    playerId: PENALTY_TRY_PLAYER_ID,
    jugador: PENALTY_TRY_PLAYER_NAME,
    dorsal: PENALTY_TRY_DORSAL,
    isTitularOrSuplente: true,
    isCaptain: false,
    actions: existing?.actions ?? { E: 0, T: 0, PC: 0, Tar: 0 },
  }
}

export function ensurePenaltyTryPlayerOnTeam(team: MatchTeam): MatchTeam {
  const realPlayers = team.players.filter((p) => !isPenaltyTryPlayer(p.playerId))
  const existing = team.players.find((p) => isPenaltyTryPlayer(p.playerId))
  const penaltyLine = createPenaltyTryPlayerLine(existing)
  return { ...team, players: [...realPlayers, penaltyLine] }
}

export function reportHasPenaltyTryPlayers(report: MatchReport): boolean {
  const has = (team: MatchTeam) => team.players.some((p) => isPenaltyTryPlayer(p.playerId))
  return has(report.local) && has(report.visitante)
}

/** Añade el jugador ficticio al final de cada plantilla y recalcula marcador/clasificación. */
export function ensurePenaltyTryPlayersOnReport(report: MatchReport): MatchReport {
  if (reportHasPenaltyTryPlayers(report)) {
    return report
  }
  const withPlayers: MatchReport = {
    ...report,
    local: ensurePenaltyTryPlayerOnTeam(report.local),
    visitante: ensurePenaltyTryPlayerOnTeam(report.visitante),
  }
  return recalculateMatchReport(withPlayers)
}
