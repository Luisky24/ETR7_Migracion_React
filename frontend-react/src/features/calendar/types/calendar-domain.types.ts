/**
 * Modelo de dominio de lectura (frontend).
 * Independiente del wire-format GAS; puede evolucionar sin arrastrar legacy.
 */

import type { CalendarMatchState, CalendarCategory, CalendarPhase } from '../contracts/calendar.contract'

/** Partido / encuentro como entidad de lectura en el dominio React. */
export interface CalendarMatch {
  readonly encuentroId: string
  readonly categoriaContext: CalendarCategory
  readonly faseContext: CalendarPhase
  readonly grupo: string
  readonly equipoLocal: string
  readonly equipoVisitante: string
  readonly hora: string
  readonly campo: string
  readonly resultadoDisplay: string
  readonly estadoAlineacionesDisplay: string
  readonly estadoPartido: CalendarMatchState
  readonly referenciaEncuentro: string
}
