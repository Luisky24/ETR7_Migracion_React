import type {
  MatchReferee,
  MatchScore,
  PlayerMatchStatsWire,
  TeamSide,
  TeamTotals,
} from '../matchReport.contract'
import type { ActaDocumentMetadata } from './actaMetadata.contract'
import type { MatchClassificationDocument } from './classification.contract'
import type { MatchIdentity } from './matchIdentity.contract'

export interface MatchTeamDocument {
  readonly side: TeamSide
  readonly equipo: string
  readonly delegado: string
  readonly entrenador: string
  readonly players: readonly PlayerMatchStatsWire[]
  readonly totals: TeamTotals
  readonly observaciones: string
}

export interface MatchScoringDocument {
  readonly score: MatchScore
  readonly incidencias: string
  readonly closePolicy?: 'actions' | 'score_only'
}

export interface MatchRefereeDocument {
  readonly referee?: MatchReferee
}

export interface MatchObservationsDocument {
  readonly incidencias: string
  readonly observacionesLocal: string
  readonly observacionesVisitante: string
}

/** Contrato documental oficial persistente (schema V1). */
export interface ActaDocumentV1 {
  readonly metadata: ActaDocumentMetadata
  readonly match: MatchIdentity
  readonly localTeam: MatchTeamDocument
  readonly awayTeam: MatchTeamDocument
  readonly scoring: MatchScoringDocument
  readonly referee: MatchRefereeDocument
  readonly observations: MatchObservationsDocument
  readonly classification: MatchClassificationDocument
}
