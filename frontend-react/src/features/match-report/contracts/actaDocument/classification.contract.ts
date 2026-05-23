import type { MatchClassification } from '../matchReport.contract'

/**
 * Puntos clasificatorios del encuentro (P/BO/BD/Total).
 * No representa la clasificación global del campeonato.
 */
export interface MatchClassificationOfficial {
  readonly local: MatchClassification
  readonly visitante: MatchClassification
  readonly source: 'server'
  readonly appliedAt: string
}

export interface MatchClassificationDocument {
  readonly local: MatchClassification
  readonly visitante: MatchClassification
  /** Clasificación oficial del servidor tras cierre (si difiere del preview cliente). */
  readonly official?: MatchClassificationOfficial
}
