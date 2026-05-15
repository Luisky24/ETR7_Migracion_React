/**
 * Sincronización draft ↔ servidor tras GET, SAVE o CONFIRM.
 * @module alineaciones-v2/reconcile
 */
import type {
  TeamLineupContextDto,
  TeamLineupContextWire,
} from '../contracts/teamLineupContext.contract'
import type { TeamLineupDraftState } from '../types/teamLineupDraft.types'
import { cloneLineupDraft } from './lineupDraftCompare'

/** Construye draft editable desde el contexto servidor (GET / reconcile). */
export function lineupDraftFromContext(context: TeamLineupContextDto): TeamLineupDraftState {
  return {
    delegado: context.delegado,
    entrenador: context.entrenador,
    jugadores: context.jugadores.map((j) => ({
      nombre: j.nombre,
      titular: j.titular,
      suplente: j.suplente,
      capitan: j.capitan,
      dorsal: j.dorsal,
    })),
  }
}

export interface LineupReconcileResult {
  readonly draft: TeamLineupDraftState
  /** Snapshot persistido; igual a draft tras reconcile exitoso → dirty-state limpio. */
  readonly persistedSnapshot: TeamLineupDraftState
}

/**
 * Aplica respuesta GET al estado local tras carga, guardado o confirmación.
 * Retorna null si el wire no es contexto OK (sin mutar estado previo del caller).
 */
export function reconcileLineupDraftFromWire(
  wire: TeamLineupContextWire | null,
): LineupReconcileResult | null {
  if (!wire || !wire.ok) {
    return null
  }
  const draft = lineupDraftFromContext(wire.context)
  const persistedSnapshot = cloneLineupDraft(draft)
  return { draft, persistedSnapshot }
}
