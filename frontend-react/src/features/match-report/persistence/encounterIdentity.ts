/** Número de encuentro estable derivado del matchId (sin documento persistido). */
export function stableEncounterNumberFromMatchId(matchId: string): number {
  let h = 0
  for (let i = 0; i < matchId.length; i += 1) {
    h = (Math.imul(31, h) + matchId.charCodeAt(i)) | 0
  }
  return (Math.abs(h) % 99999) + 1
}
