import type { TeamLineupPlayerDto } from '../contracts/teamLineupContext.contract'

/** Avisos no bloqueantes (SAVE flexible, misma filosofía que legacy al guardar). */
export function computeLineupSoftWarnings(jugadores: readonly TeamLineupPlayerDto[]): string[] {
  const w: string[] = []
  let titulares = 0
  let suplentes = 0
  let capitanes = 0
  const dorsales = new Map<number, string>()
  for (const j of jugadores) {
    if (j.titular) titulares++
    if (j.suplente) suplentes++
    if (j.capitan) capitanes++
    if ((j.titular || j.suplente) && j.dorsal != null && j.dorsal > 0) {
      const prev = dorsales.get(j.dorsal)
      if (prev && prev !== j.nombre) {
        w.push(`Dorsal ${String(j.dorsal)} duplicado (${j.nombre} / ${prev}).`)
      }
      dorsales.set(j.dorsal, j.nombre)
    }
    if ((j.titular || j.suplente) && (j.dorsal == null || j.dorsal < 1 || j.dorsal > 99)) {
      w.push(`Jugador «${j.nombre}»: titular/suplente sin dorsal válido (1–99).`)
    }
  }
  if (titulares !== 7) {
    w.push(`Titulares: ${String(titulares)} (la confirmación exigirá exactamente 7).`)
  }
  if (suplentes > 5) {
    w.push(`Suplentes: ${String(suplentes)} (máximo 5 en confirmación).`)
  }
  if (capitanes !== 1) {
    w.push(`Capitanes: ${String(capitanes)} (la confirmación exigirá exactamente 1).`)
  }
  return w
}
