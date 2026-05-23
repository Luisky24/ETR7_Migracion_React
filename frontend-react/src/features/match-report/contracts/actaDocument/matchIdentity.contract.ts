import type { MatchCategory, MatchPhaseLabel } from '../matchReport.contract'

/** Snapshot inmutable del encuentro al materializar el acta. */
export interface MatchEncounterSnapshot {
  readonly grupo: string
  readonly equipoLocal: string
  readonly equipoVisitante: string
  readonly hora: string
  readonly campo: string
  /** Número de encuentro en repositorio único (naming `ACT_*_EncuentroN`). */
  readonly encounterNumber: number
}

/** Identidad lógica y física del documento JSON. */
export interface MatchIdentity {
  readonly matchId: string
  readonly documentName: string
  readonly category: MatchCategory
  readonly phase: MatchPhaseLabel
  readonly encounter: MatchEncounterSnapshot
  readonly referenciaEncuentro?: string
}
