import type { MatchCategory, MatchPhaseLabel } from '../contracts'

export function buildEncuentroId(
  grupo: string,
  equipoLocal: string,
  equipoVisitante: string,
  referenciaEncuentro?: string,
): string {
  const base = `${grupo}|${equipoLocal}|${equipoVisitante}`
  const ref = referenciaEncuentro?.trim()
  if (ref) return `${base}::ref::${ref}`
  return base
}

export function isFase2(phase: MatchPhaseLabel): boolean {
  return phase === 'Fase II'
}

export function categoryLabel(category: MatchCategory): string {
  return category === 'M' ? 'Masculino' : 'Femenino'
}
