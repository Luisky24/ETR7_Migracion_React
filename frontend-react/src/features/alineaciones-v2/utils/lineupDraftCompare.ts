import type { TeamLineupDraftState } from '../types/teamLineupDraft.types'

/** Copia profunda del borrador para snapshot persistido. */
export function cloneLineupDraft(draft: TeamLineupDraftState): TeamLineupDraftState {
  return {
    delegado: draft.delegado,
    entrenador: draft.entrenador,
    jugadores: draft.jugadores.map((j) => ({
      nombre: j.nombre,
      titular: j.titular,
      suplente: j.suplente,
      capitan: j.capitan,
      dorsal: j.dorsal,
    })),
  }
}

/** Comparación estructural draft vs último snapshot cargado/guardado. */
export function areLineupDraftsEqual(a: TeamLineupDraftState, b: TeamLineupDraftState): boolean {
  if (a.delegado !== b.delegado || a.entrenador !== b.entrenador) {
    return false
  }
  if (a.jugadores.length !== b.jugadores.length) {
    return false
  }
  for (let i = 0; i < a.jugadores.length; i++) {
    const ja = a.jugadores[i]!
    const jb = b.jugadores[i]!
    if (
      ja.nombre !== jb.nombre ||
      ja.titular !== jb.titular ||
      ja.suplente !== jb.suplente ||
      ja.capitan !== jb.capitan ||
      ja.dorsal !== jb.dorsal
    ) {
      return false
    }
  }
  return true
}
