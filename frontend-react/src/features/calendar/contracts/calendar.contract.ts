/**
 * Contratos públicos del dominio Calendario (React).
 * Formas estables, explícitas y desacopladas del transporte GAS.
 * No exponer tuplas ni estructuras posicionales legacy.
 */

/** Categoría competición (código interno estable). */
export type CalendarCategory = 'M' | 'F'

/** Fase de competición (literales alineados con GAS / legacy). */
export type CalendarPhase = 'Fase I' | 'Fase II'

/**
 * Estados de partido persistidos en hoja (columna estado_partido) y usados en UI legacy.
 * Incluye alias históricos que el backend puede devolver; el adapter normaliza a canónicos.
 */
export type CalendarMatchState =
  | 'sin_alineacion'
  | 'alineacion_parcial'
  | 'acta_abierta'
  | 'acta_cerrada'
  /** Valor ausente o no parseable como estado conocido (solo transporte hacia UI, sin reinterpretar negocio). */
  | 'unspecified'

export interface CalendarMatchDto {
  readonly encuentroId: string
  readonly grupo: string
  readonly equipoLocal: string
  readonly equipoVisitante: string
  readonly hora: string
  readonly campo: string
  readonly resultadoDisplay: string
  readonly estadoAlineacionesDisplay: string
  readonly estadoPartido: CalendarMatchState
  readonly referenciaEncuentro: string
}

/**
 * Respuesta de lectura de encuentros normalizada.
 * `matchesByEncuentroId`: claves `grupo|local|visit` o, si hay referencia de encuentro (Fase II), `grupo|local|visit::ref::<referencia>` para evitar colisiones.
 */
export interface CalendarMatchesResponse {
  readonly schemaVersion: 2
  readonly matchesByEncuentroId: Readonly<Record<string, CalendarMatchDto>>
}

/** Filtros de lectura (UI / servicio). Campos opcionales reservados para evolución sin romper API. */
export interface CalendarFilters {
  readonly categoria: CalendarCategory
  readonly fase: CalendarPhase
  /** Reservado: filtro por grupo en capa UI futura. */
  readonly grupo?: string
  /** Reservado: búsqueda libre en capa UI futura. */
  readonly searchText?: string
}

/**
 * Objeto match tal como lo emite `calendar_getMatches_v2` (GAS).
 * Contrato oficial backend; sin tuplas posicionales.
 * `estadoPartido` en wire es string; la normalización canónica ocurre en GAS — el adapter solo valida.
 */
export interface GasCalendarMatchV2 {
  readonly idEncuentro: string
  readonly grupo: string
  readonly equipoLocal: string
  readonly equipoVisitante: string
  readonly hora: string
  readonly campo: string
  readonly resultado: string
  readonly estadoAlineaciones: string
  readonly estadoPartido: string
  readonly referenciaEncuentro: string
}

/** Respuesta estable del boundary GAS `calendar_getMatches_v2`. */
export interface GasCalendarGetMatchesV2Response {
  readonly version: 2
  readonly matches: readonly GasCalendarMatchV2[]
}
