/** Identificador estable de jugador en acta (sin arrays legacy). */
export function buildPlayerId(dorsal: number, jugador: string): string {
  const name = jugador.trim().toLowerCase().replace(/\s+/g, '_')
  return `${String(dorsal)}::${name}`
}
