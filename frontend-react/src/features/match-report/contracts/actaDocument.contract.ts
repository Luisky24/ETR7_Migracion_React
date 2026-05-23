import type {
  MatchCategory,
  MatchPhaseLabel,
  MatchReferee,
  PlayerMatchStatsWire,
  TeamTotals,
} from './matchReport.contract'

/**
 * Proyección plana legacy (GAS / `buildActaDocumentV1`).
 * @deprecated Preferir `ActaDocumentV1` anidado en `./actaDocument/`.
 */
export interface ActaDocumentV1LegacyFlat {
  readonly version: 1
  readonly categoria: MatchCategory
  readonly fase: MatchPhaseLabel
  readonly idEncuentro: string
  readonly referencia_encuentro?: string
  readonly resultadoLocal: number
  readonly resultadoVisitante: number
  readonly incidencias: string
  readonly referee?: MatchReferee
  readonly observacionesLocal: string
  readonly observacionesVisitante: string
  readonly arrResultadoLocal: readonly PlayerMatchStatsWire[]
  readonly arrResultadoVisitante: readonly PlayerMatchStatsWire[]
  readonly arrTotalesLocal: TeamTotals
  readonly arrTotalesVisitante: TeamTotals
  readonly cerrada: boolean
}
