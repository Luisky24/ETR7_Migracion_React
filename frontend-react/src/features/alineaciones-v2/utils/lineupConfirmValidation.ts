import type { TeamLineupPlayerDto } from '../contracts/teamLineupContext.contract'
import {
  LINEUP_CONFIRM_MAX_SUPLENTES,
  LINEUP_CONFIRM_REQUIRED_CAPITANES,
  LINEUP_CONFIRM_REQUIRED_TITULARES,
  LINEUP_DORSAL_MAX,
  LINEUP_DORSAL_MIN,
} from './lineupDomain.constants'

export interface LineupConfirmValidationInput {
  readonly delegado: string | null | undefined
  readonly entrenador: string | null | undefined
  readonly jugadores: readonly TeamLineupPlayerDto[]
}

function isBlankStaffField(value: string | null | undefined): boolean {
  return value == null || value.trim() === ''
}

function computeStaffConfirmBlockingErrors(
  delegado: string | null | undefined,
  entrenador: string | null | undefined,
): string[] {
  const missingDelegado = isBlankStaffField(delegado)
  const missingEntrenador = isBlankStaffField(entrenador)
  if (missingDelegado && missingEntrenador) {
    return ['Debe indicarse un delegado y un entrenador para confirmar la alineación.']
  }
  if (missingDelegado) {
    return ['Debe indicarse un delegado para confirmar la alineación.']
  }
  if (missingEntrenador) {
    return ['Debe indicarse un entrenador para confirmar la alineación.']
  }
  return []
}

function computePlayerConfirmBlockingErrors(jugadores: readonly TeamLineupPlayerDto[]): string[] {
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
      if (j.dorsal == null || j.dorsal < LINEUP_DORSAL_MIN || j.dorsal > LINEUP_DORSAL_MAX) {
        errors.push(
          `«${j.nombre}»: dorsal obligatorio entre ${String(LINEUP_DORSAL_MIN)} y ${String(LINEUP_DORSAL_MAX)} para titulares/suplentes.`,
        )
      } else {
        const prev = dorsalToNombre.get(j.dorsal)
        if (prev && prev !== j.nombre) {
          errors.push(`Dorsal ${String(j.dorsal)} duplicado («${j.nombre}» / «${prev}»).`)
        }
        dorsalToNombre.set(j.dorsal, j.nombre)
      }
    }
  }
  if (titulares !== LINEUP_CONFIRM_REQUIRED_TITULARES) {
    errors.push(
      `Debe haber exactamente ${String(LINEUP_CONFIRM_REQUIRED_TITULARES)} titulares (ahora: ${String(titulares)}).`,
    )
  }
  if (suplentes > LINEUP_CONFIRM_MAX_SUPLENTES) {
    errors.push(
      `Máximo ${String(LINEUP_CONFIRM_MAX_SUPLENTES)} suplentes (ahora: ${String(suplentes)}).`,
    )
  }
  if (capitanes !== LINEUP_CONFIRM_REQUIRED_CAPITANES) {
    errors.push(
      `Debe haber exactamente ${String(LINEUP_CONFIRM_REQUIRED_CAPITANES)} capitán (ahora: ${String(capitanes)}).`,
    )
  }
  return errors
}

/**
 * Validación estricta alineada con confirmación en backend (bloquea confirmación en UI).
 */
export function computeLineupConfirmBlockingErrors(input: LineupConfirmValidationInput): string[] {
  return [
    ...computeStaffConfirmBlockingErrors(input.delegado, input.entrenador),
    ...computePlayerConfirmBlockingErrors(input.jugadores),
  ]
}
