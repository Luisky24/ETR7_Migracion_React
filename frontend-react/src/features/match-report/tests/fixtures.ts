import type {
  MatchContext,
  MatchReport,
  PlayerMatchActions,
  PlayerMatchLine,
  TeamSide,
} from '../contracts'
import { deriveEditability } from '../domain'
import { createPenaltyTryPlayerLine } from '../presentation/penaltyTryPlayer'
import { buildPlayerId } from '../utils/playerRowKeys'
import { buildEncuentroId } from '../utils/phaseCategory'

export function playerLine(
  jugador: string,
  dorsal: number,
  actions: Partial<PlayerMatchActions> = {},
  opts: { titular?: boolean; captain?: boolean } = {},
): PlayerMatchLine {
  const isTitularOrSuplente = opts.titular !== false
  return {
    playerId: buildPlayerId(dorsal, jugador),
    jugador,
    dorsal,
    isTitularOrSuplente,
    isCaptain: opts.captain ?? false,
    actions: {
      E: actions.E ?? 0,
      T: actions.T ?? 0,
      PC: actions.PC ?? 0,
      Tar: actions.Tar ?? 0,
    },
  }
}

export function baseContext(overrides: Partial<MatchContext> = {}): MatchContext {
  const grupo = overrides.grupo ?? 'A'
  const equipoLocal = overrides.equipoLocal ?? 'LOCAL'
  const equipoVisitante = overrides.equipoVisitante ?? 'VISITANTE'
  const referenciaEncuentro = overrides.referenciaEncuentro ?? ''
  return {
    category: 'M',
    phase: 'Fase I',
    grupo,
    equipoLocal,
    equipoVisitante,
    hora: '12:00',
    campo: 'Campo 1',
    resultadoDisplay: '',
    estadoAlineacionesDisplay: 'C - C',
    matchStatus: 'acta_abierta',
    referenciaEncuentro,
    encuentroId: buildEncuentroId(grupo, equipoLocal, equipoVisitante, referenciaEncuentro),
    ...overrides,
  }
}

function team(side: TeamSide, players: PlayerMatchLine[], equipo: string): MatchReport['local'] {
  const withPenaltyTry = [...players, createPenaltyTryPlayerLine()]
  return {
    side,
    equipo,
    delegado: 'Delegado',
    entrenador: 'Entrenador',
    players: withPenaltyTry,
    totals: { E: 0, T: 0, PC: 0, Tar: 0 },
    classification: { P: 0, BO: 0, BD: 0, Total: 0 },
    observaciones: '',
  }
}

export function emptyMatchReport(context: MatchContext = baseContext()): MatchReport {
  const localPlayers = [
    playerLine('Jugador L1', 1, {}, { titular: true }),
    playerLine('Jugador L2', 2, {}, { titular: true }),
  ]
  const visitPlayers = [
    playerLine('Jugador V1', 3, {}, { titular: true }),
    playerLine('Jugador V2', 4, {}, { titular: true }),
  ]
  return {
    context,
    cerrada: context.matchStatus === 'acta_cerrada',
    fromActaSnapshot: false,
    modoBorrador: true,
    local: team('local', localPlayers, context.equipoLocal),
    visitante: team('visitante', visitPlayers, context.equipoVisitante),
    score: { local: 0, visitante: 0 },
    incidencias: '',
    editability: deriveEditability(context.matchStatus, context.matchStatus === 'acta_cerrada'),
  }
}

export function matchReportWithScore(
  localScore: number,
  visitScore: number,
  context?: MatchContext,
): MatchReport {
  const report = emptyMatchReport(context)
  if (localScore === 0 && visitScore === 0) return report

  const local = playerLine('Capitan L', 1, { E: localScore > 0 ? 1 : 0 }, { titular: true, captain: true })
  const visit = playerLine('Capitan V', 3, { E: visitScore > 0 ? 1 : 0 }, { titular: true, captain: true })

  return {
    ...report,
    local: { ...report.local, players: [local, createPenaltyTryPlayerLine()] },
    visitante: { ...report.visitante, players: [visit, createPenaltyTryPlayerLine()] },
  }
}
