import type { TeamLineupPlayerDto } from '../contracts/teamLineupContext.contract'

/**
 * Validación estricta alineada con `alineacionesConfirmTeamLineupV2` (bloquea confirmación en UI).
 */
export function computeLineupConfirmBlockingErrors(jugadores: readonly TeamLineupPlayerDto[]): string[] {
  const errors: string[] = []
  for (const j of jugadores) {
    if (j.titular && j.suplente) {
      errors.push(`«${j.nombre}» no puede ser titular y suplente a la vez.`)
    }
  }
  let titulares = 0
  let suplentes = 0
  let capitanes = 0
  const dorsalToNombre = new Map<number, string>()
  for (const j of jugadores) {
    if (j.titular) titulares++
    if (j.suplente) suplentes++
    if (j.capitan) capitanes++
    if (j.titular || j.suplente) {
      if (j.dorsal == null || j.dorsal < 1 || j.dorsal > 99) {
        errors.push(`«${j.nombre}»: dorsal obligatorio entre 1 y 99 para titulares/suplentes.`)
      } else {
        const prev = dorsalToNombre.get(j.dorsal)
        if (prev && prev !== j.nombre) {
          errors.push(`Dorsal ${String(j.dorsal)} duplicado («${j.nombre}» / «${prev}»).`)
        }
        dorsalToNombre.set(j.dorsal, j.nombre)
      }
    }
  }
  if (titulares !== 7) {
    errors.push(`Debe haber exactamente 7 titulares (ahora: ${String(titulares)}).`)
  }
  if (suplentes > 5) {
    errors.push(`Máximo 5 suplentes (ahora: ${String(suplentes)}).`)
  }
  if (capitanes !== 1) {
    errors.push(`Debe haber exactamente 1 capitán (ahora: ${String(capitanes)}).`)
  }
  return errors
}
