/**
 * Formas wire GAS / SPA legacy — solo consumidas por adapters.
 * No importar desde dominio, reducer, hooks de UI ni selectores.
 */

/** Fila calendario legacy (`encuentro[]`) con acceso por nombre, no por índice en capas superiores. */
export interface LegacyEncuentroFields {
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

/** Jugador legacy: alineación (5) o acta guardada (9). */
export interface LegacyJugadorFields {
  readonly nombre: string
  readonly titular: string
  readonly suplente: string
  readonly capitan: string
  readonly dorsal: number
  readonly E: number
  readonly T: number
  readonly PC: number
  readonly Tar: number
  readonly hasActaStats: boolean
}

/** Vista wire de alineación/equipo devuelta por `obtenerAlineacionesSPA`. */
export interface GasTeamLineupWire {
  readonly equipo: string
  readonly delegado: string
  readonly entrenador: string
  readonly jugadores: readonly unknown[]
  /** Observaciones del equipo en acta persistida (opcional en wire). */
  readonly observaciones?: string
}

/** Metadatos opcionales en respuesta de carga (tercer elemento del array o envoltorio futuro). */
export interface GasActaLoadMetadataWire {
  readonly arbitro?: string
  readonly incidencias?: string
  readonly observacionesLocal?: string
  readonly observacionesVisitante?: string
}

/** Respuesta SPA de `obtenerAlineacionesSPA`: [local, visitante]. */
export type GasObtenerAlineacionesResponse = readonly [
  GasTeamLineupWire | null,
  GasTeamLineupWire | null,
]

/** Payload legacy hacia `guardarActa` / `cerrarActaCompleta`. */
export interface GasGuardarActaPayload {
  readonly categoria: 'M' | 'F'
  readonly fase: 'Fase I' | 'Fase II'
  readonly encuentro: readonly string[]
  readonly idEncuentro?: string
  readonly referencia_encuentro?: string
  readonly resultadoLocal: number
  readonly resultadoVisitante: number
  readonly incidencias: string
  /** Paridad legacy `estrucResultadosComun.arbitro` (opcional hasta soporte GAS completo). */
  readonly arbitro?: string
  readonly arrResultadoLocal: readonly Record<string, unknown>[]
  readonly arrResultadoVisitante: readonly Record<string, unknown>[]
  readonly arrTotalesLocal: Record<string, number>
  readonly arrTotalesVisitante: Record<string, number>
  readonly arrPuntosConseguidosLocal: Record<string, number>
  readonly arrPuntosConseguidosVisitante: Record<string, number>
  readonly cerrar: boolean
}

export interface GasGuardarActaResult {
  readonly ok?: boolean
  readonly cerrada?: boolean
  readonly perf?: Readonly<Record<string, number>>
}

export interface GasCerrarActaResult {
  readonly ok?: boolean
  readonly cerrada?: boolean
  readonly perf?: Readonly<Record<string, number>>
}
