/**
 * Contratos públicos alineaciones read-only (React).
 * Alineados con el boundary GAS `alineaciones_getMatchLineups_v2`.
 */

import type { CalendarCategory, CalendarPhase } from '@/features/calendar/contracts/calendar.contract'

export interface MatchLineupPlayerDto {
  readonly dorsal: number
  readonly nombre: string
  readonly titular: boolean
  readonly capitan: boolean
}

export interface MatchLineupTeamDto {
  readonly teamName: string
  readonly entrenador?: string
  readonly delegado?: string
  readonly jugadores: readonly MatchLineupPlayerDto[]
}

export interface MatchLineupsResponse {
  readonly schemaVersion: 2
  readonly encuentroId: string
  readonly local: MatchLineupTeamDto
  readonly visitante: MatchLineupTeamDto
}

export interface MatchLineupsQuery {
  readonly categoria: CalendarCategory
  readonly fase: CalendarPhase
  /** Clave de registro del calendario (puede incluir `::ref::`). */
  readonly recordKey: string
}

/** Wire GAS — jugador. */
export interface GasMatchLineupPlayerV2 {
  readonly dorsal: number
  readonly nombre: string
  readonly titular: boolean
  readonly capitan: boolean
}

/** Wire GAS — bloque equipo. */
export interface GasMatchLineupTeamV2 {
  readonly teamName: string
  readonly entrenador?: string
  readonly delegado?: string
  readonly jugadores: readonly GasMatchLineupPlayerV2[]
}

/** Respuesta estable del boundary `alineaciones_getMatchLineups_v2`. */
export interface GasAlineacionesGetMatchLineupsV2Response {
  readonly version: 2
  readonly encuentroId: string
  readonly local: GasMatchLineupTeamV2
  readonly visitante: GasMatchLineupTeamV2
}
