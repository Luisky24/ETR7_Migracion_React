import type { MatchClosureErrorCode } from './errors.contract'
import type { MatchReportDocumentRuntimeState } from '../types/matchReportDocumentRuntime.types'

export type MatchCategory = 'M' | 'F'
export type MatchPhaseLabel = 'Fase I' | 'Fase II'

export type MatchStatus =
  | 'sin_alineacion'
  | 'alineacion_parcial'
  | 'acta_abierta'
  | 'acta_cerrada'

export type ActaEditability = 'editable' | 'read_only' | 'blocked'

export type TeamSide = 'local' | 'visitante'

/** Árbitro del encuentro (modelo persistente futuro JSON / acta). */
export interface MatchReferee {
  readonly name: string
}

/** Contexto inyectado desde Calendario (sin arrays legacy). */
export interface MatchContext {
  readonly category: MatchCategory
  readonly phase: MatchPhaseLabel
  readonly encuentroId: string
  readonly grupo: string
  readonly equipoLocal: string
  readonly equipoVisitante: string
  readonly hora: string
  readonly campo: string
  readonly resultadoDisplay: string
  readonly estadoAlineacionesDisplay: string
  readonly matchStatus: MatchStatus
  readonly referenciaEncuentro: string
}

export interface PlayerMatchActions {
  readonly E: number
  readonly T: number
  readonly PC: number
  readonly Tar: number
}

export interface PlayerMatchLine {
  readonly playerId: string
  readonly jugador: string
  readonly dorsal: number
  readonly isTitularOrSuplente: boolean
  readonly isCaptain: boolean
  readonly actions: PlayerMatchActions
}

export interface TeamTotals {
  readonly E: number
  readonly T: number
  readonly PC: number
  readonly Tar: number
}

export interface MatchTeam {
  readonly side: TeamSide
  readonly equipo: string
  readonly delegado: string
  readonly entrenador: string
  readonly players: readonly PlayerMatchLine[]
  readonly totals: TeamTotals
  readonly classification: MatchClassification
  readonly observaciones: string
}

export interface MatchScore {
  readonly local: number
  readonly visitante: number
}

export interface MatchClassification {
  readonly P: number
  readonly BO: number
  readonly BD: number
  readonly Total: number
}

export interface MatchActionSummary {
  readonly hasAnyAction: boolean
  readonly totalActionsCount: number
  readonly localTotals: TeamTotals
  readonly visitanteTotals: TeamTotals
}

export interface MatchReport {
  readonly context: MatchContext
  readonly cerrada: boolean
  readonly fromActaSnapshot: boolean
  readonly modoBorrador: boolean
  readonly local: MatchTeam
  readonly visitante: MatchTeam
  readonly score: MatchScore
  readonly incidencias: string
  /** Nombre del árbitro; ausente si no se ha indicado. */
  readonly referee?: MatchReferee
  readonly editability: ActaEditability
}

export interface MatchValidationIssue {
  readonly code: string
  readonly message: string
  readonly field?: string
}

export interface MatchValidationResult {
  readonly ok: boolean
  readonly errors: readonly MatchValidationIssue[]
  readonly warnings: readonly MatchValidationIssue[]
}

export interface MatchClosureResult {
  readonly ok: boolean
  readonly cerrada: boolean
  readonly errorCode?: MatchClosureErrorCode
  readonly message?: string
  readonly perf?: Readonly<Record<string, number>>
  readonly serverClassification?: {
    readonly local: MatchClassification
    readonly visitante: MatchClassification
  }
}

export interface PlayerMatchStatsWire {
  readonly jugador: string
  readonly dorsal: string | number
  readonly E: number
  readonly T: number
  readonly PC: number
  readonly Tar: number
}

/** DTO de persistencia — frontera save/close (wire solo en adapters). */
export interface MatchPersistenceDTO {
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
  readonly arrPuntosConseguidosLocal: MatchClassification
  readonly arrPuntosConseguidosVisitante: MatchClassification
  readonly cerrar: boolean
}

export interface LoadMatchReportRequest {
  readonly context: MatchContext
}

export interface LoadMatchReportResponse {
  readonly report: MatchReport
  readonly cerrada: boolean
  readonly fromActaSnapshot: boolean
  /** A4.2: estado documental runtime normalizado (única fuente metadata/refs/reconcile). */
  readonly document: MatchReportDocumentRuntimeState
  /** @deprecated Usar `document.metadata.workspaceVersion`. */
  readonly workspaceVersion?: number
  /** @deprecated Usar `document.metadata.actaBinding`. */
  readonly actaBinding?: 'ACTIVE' | 'SUPERSEDED'
}
