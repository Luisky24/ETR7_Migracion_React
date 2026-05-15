import type { TeamLineupPlayerDto } from '../contracts/teamLineupContext.contract'

/** Estado editable local de alineación (draft / snapshot persistido). */
export interface TeamLineupDraftState {
  readonly delegado: string
  readonly entrenador: string
  readonly jugadores: readonly TeamLineupPlayerDto[]
}
