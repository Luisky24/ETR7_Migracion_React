import type { PlayerMatchActions } from '../contracts'

const MAX_ACTION_COUNT = 99

export function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_ACTION_COUNT
}

/** Solo formato numérico por campo; la regla T≤E es agregada por equipo (dominio). */
export function validateActionInputPatch(patch: Partial<PlayerMatchActions>): string | null {
  for (const [key, value] of Object.entries(patch) as [keyof PlayerMatchActions, number][]) {
    if (value === undefined) continue
    if (!isNonNegativeInteger(value)) {
      return `Valor inválido para ${key}.`
    }
  }
  return null
}
