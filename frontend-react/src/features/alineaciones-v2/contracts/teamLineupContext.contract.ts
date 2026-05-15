/**
 * Contratos boundary `alineaciones_getTeamLineupContext_v2` (workflow operativo por equipo).
 * Sin tuplas legacy; jugadores como objetos nombrados.
 */

export type TeamLineupCalendarSlotState = 'P' | 'E' | 'C' | 'F' | 'EMPTY'

export type TeamLineupMatchState =
  | 'sin_alineacion'
  | 'alineacion_parcial'
  | 'acta_abierta'
  | 'acta_cerrada'
  | 'unspecified'

export interface TeamLineupPlayerDto {
  readonly nombre: string
  readonly titular: boolean
  readonly suplente: boolean
  readonly capitan: boolean
  readonly dorsal: number | null
}

export interface TeamLineupPermissionsDto {
  readonly canRead: boolean
  readonly canEdit: boolean
  readonly canConfirm: boolean
  readonly canSelectTeam: boolean
  readonly protectedMode: boolean
  readonly reasonCodes: readonly string[]
}

export interface TeamLineupWorkflowStateDto {
  readonly teamSlotState: TeamLineupCalendarSlotState
  readonly opponentSlotState: TeamLineupCalendarSlotState
  readonly matchState: TeamLineupMatchState
  readonly sheetStateEnc: string | null
}

export interface MatchRefDto {
  readonly categoria: string
  readonly fase: string
  readonly grupo: string
  readonly equipoLocal: string
  readonly equipoVisitante: string
  readonly encuentroLabel: string
  readonly hora: string | null
  readonly campo: string | null
  readonly referenciaEncuentro: string | null
  readonly numFilaCalendario: number | string | null
}

export interface TeamLineupContextDto {
  readonly match: MatchRefDto
  readonly equipoOperativo: string
  readonly indLocalVisitante: 'L' | 'V'
  readonly contrario: string
  readonly delegado: string
  readonly entrenador: string
  readonly jugadores: readonly TeamLineupPlayerDto[]
  readonly nivelAcceso: number
  readonly role: string
  readonly origenModelo: string
}

export interface TeamLineupContextFlagsDto {
  readonly fromActaSnapshot: boolean
  readonly cerradaPorActa: boolean
  readonly staleRiskEncVsCalendar: boolean
}

export interface TeamLineupContextMetadataDto {
  readonly version: number
  readonly serverTime: string
  /**
   * Reservado para locking optimista (Fase 3+). El runtime React lo expone en
   * `LineupRuntimeState.serverEtag` pero no lo usa para validar SAVE/CONFIRM en Fase 2.
   */
  readonly etag: string | null
}

export interface TeamLineupContextResponse {
  readonly ok: true
  readonly context: TeamLineupContextDto
  readonly permissions: TeamLineupPermissionsDto
  readonly workflow: TeamLineupWorkflowStateDto
  readonly flags: TeamLineupContextFlagsDto
  readonly metadata: TeamLineupContextMetadataDto
}

export interface TeamLineupContextErrorBody {
  readonly ok: false
  readonly error: { readonly code: string; readonly message: string }
  readonly metadata: TeamLineupContextMetadataDto
}

export type TeamLineupContextWire = TeamLineupContextResponse | TeamLineupContextErrorBody

export interface TeamLineupSaveSuccessBody {
  readonly ok: true
  readonly metadata: TeamLineupContextMetadataDto
}

export type TeamLineupSaveWire = TeamLineupSaveSuccessBody | TeamLineupContextErrorBody

/** Petición serializable al boundary (JSON en GAS). */
export interface TeamLineupContextRequest {
  readonly categoria: string
  readonly fase: string
  readonly recordKey: string
  readonly equipoOperativo: string
  readonly nivelAcceso: number
  readonly sesionEquipo?: string
  readonly matchSnapshot?: {
    readonly grupo?: string
    readonly hora?: string
    readonly campo?: string
    readonly resultado?: string
    readonly estadoAlineaciones?: string
    readonly estadoPartido?: string
    readonly referenciaEncuentro?: string
  }
}

/** Incluye payload editable para `alineaciones_saveTeamLineup_v2`. */
export type TeamLineupSaveRequest = TeamLineupContextRequest & {
  readonly delegado: string
  readonly entrenador: string
  readonly jugadores: readonly TeamLineupPlayerDto[]
}

/** Mismo cuerpo que SAVE; boundary `alineaciones_confirmTeamLineup_v2`. */
export type TeamLineupConfirmRequest = TeamLineupSaveRequest

export type TeamLineupConfirmSuccessBody = TeamLineupSaveSuccessBody
export type TeamLineupConfirmWire = TeamLineupSaveWire
