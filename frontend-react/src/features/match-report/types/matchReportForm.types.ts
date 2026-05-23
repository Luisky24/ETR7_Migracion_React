import type { PlayerMatchActions, TeamSide } from '../contracts'

export type ActionFieldKey = keyof PlayerMatchActions

export function playerActionFieldKey(side: TeamSide, playerId: string, field: ActionFieldKey): string {
  return `${side}:${playerId}:${field}`
}

export const REFEREE_FIELD_KEY = 'referee:name'
export const INCIDENCIAS_FIELD_KEY = 'incidencias'

export function teamObservationsFieldKey(side: TeamSide): string {
  return `${side}:observaciones`
}
