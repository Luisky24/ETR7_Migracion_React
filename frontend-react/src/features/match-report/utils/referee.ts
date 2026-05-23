import type { MatchReferee } from '../contracts'

/** Normaliza nombre de árbitro para el modelo (vacío → sin campo). */
export function normalizeRefereeName(name: string): MatchReferee | undefined {
  const trimmed = name.trim()
  return trimmed ? { name: trimmed } : undefined
}

export function refereeDisplayName(referee: MatchReferee | undefined): string {
  return referee?.name ?? ''
}
