/**
 * Único lugar autorizado para índices posicionales legacy de la fila Calendario v2
 * (ver `formatearCalendarioF1` en GAS: grupo, local, visitante, hora, campo, resultado,
 * estadoAlineaciones, estadoPartido, referencia_encuentro).
 */

import type { CalendarCategory, CalendarPhase, CalendarMatchState } from '../contracts/calendar.contract'
import type { CalendarMatch } from '../types/calendar-domain.types'

const I = {
  grupo: 0,
  local: 1,
  visitante: 2,
  hora: 3,
  campo: 4,
  resultado: 5,
  estadoAlineaciones: 6,
  estadoPartido: 7,
  referenciaEncuentro: 8,
} as const

function strCell(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return String(v).trim()
  }
  if (v instanceof Date) {
    return v.toISOString().slice(11, 16)
  }
  return ''
}

function buildEncuentroId(grupo: string, local: string, visitante: string): string {
  return `${grupo}|${local}|${visitante}`
}

/** Normaliza códigos de estado hacia el union público sin recalcular negocio. */
export function mapLegacyEstadoPartidoToState(raw: string): CalendarMatchState {
  const v = raw.trim()
  if (!v) return 'unspecified'

  const lower = v.toLowerCase()

  const directMap: Record<string, CalendarMatchState> = {
    sin_alineacion: 'sin_alineacion',
    alineacion_parcial: 'alineacion_parcial',
    acta_abierta: 'acta_abierta',
    acta_cerrada: 'acta_cerrada',
    // Alias usados en legacy / hoja
    alineacion_local: 'alineacion_parcial',
    alineaciones_completas: 'alineacion_parcial',
    alineaciones_en_curso: 'alineacion_parcial',
  }

  const mapped = directMap[lower]
  if (mapped) return mapped

  return 'unspecified'
}

export function mapLegacyRowToCalendarMatch(
  row: unknown,
  ctx: { readonly categoria: CalendarCategory; readonly fase: CalendarPhase },
): CalendarMatch | null {
  if (!Array.isArray(row)) return null

  const grupo = strCell(row[I.grupo])
  const equipoLocal = strCell(row[I.local])
  const equipoVisitante = strCell(row[I.visitante])

  if (!equipoLocal || !equipoVisitante) return null

  const hora = strCell(row[I.hora])
  const campo = strCell(row[I.campo])
  const resultadoDisplay = strCell(row[I.resultado])
  const estadoAlineacionesDisplay = strCell(row[I.estadoAlineaciones])
  const referenciaEncuentro = strCell(row[I.referenciaEncuentro])
  const estadoPartido = mapLegacyEstadoPartidoToState(strCell(row[I.estadoPartido]))

  const encuentroId = buildEncuentroId(grupo, equipoLocal, equipoVisitante)

  return {
    encuentroId,
    categoriaContext: ctx.categoria,
    faseContext: ctx.fase,
    grupo,
    equipoLocal,
    equipoVisitante,
    hora,
    campo,
    resultadoDisplay,
    estadoAlineacionesDisplay,
    estadoPartido,
    referenciaEncuentro,
  }
}
