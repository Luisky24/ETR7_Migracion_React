/**
 * Calendario React → MatchContext (sin arrays legacy en dominio).
 */

import type { CalendarCategory, CalendarMatchDto, CalendarPhase } from '@/features/calendar/contracts/calendar.contract'
import type { MatchCategory, MatchContext, MatchPhaseLabel, MatchStatus } from '../contracts'

function toMatchCategory(categoria: CalendarCategory): MatchCategory {
  return categoria
}

function toMatchPhase(fase: CalendarPhase): MatchPhaseLabel {
  return fase
}

function toMatchStatus(estadoPartido: CalendarMatchDto['estadoPartido']): MatchStatus {
  switch (estadoPartido) {
    case 'sin_alineacion':
    case 'alineacion_parcial':
    case 'acta_abierta':
    case 'acta_cerrada':
      return estadoPartido
    default:
      return 'alineacion_parcial'
  }
}

/** Proyecta un encuentro de calendario al contexto del acta React. */
export function matchContextFromCalendar(
  categoria: CalendarCategory,
  fase: CalendarPhase,
  match: CalendarMatchDto,
): MatchContext {
  return {
    category: toMatchCategory(categoria),
    phase: toMatchPhase(fase),
    encuentroId: match.encuentroId,
    grupo: match.grupo,
    equipoLocal: match.equipoLocal,
    equipoVisitante: match.equipoVisitante,
    hora: match.hora,
    campo: match.campo,
    resultadoDisplay: match.resultadoDisplay,
    estadoAlineacionesDisplay: match.estadoAlineacionesDisplay,
    matchStatus: toMatchStatus(match.estadoPartido),
    referenciaEncuentro: match.referenciaEncuentro,
  }
}
