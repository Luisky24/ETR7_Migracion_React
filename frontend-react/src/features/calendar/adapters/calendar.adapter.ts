/**
 * Capa de adaptación GAS → contratos React (calendario read-only).
 * El boundary oficial devuelve objetos explícitos; aquí solo se valida y se proyecta a DTOs de app.
 */

import { log } from '@/core/debug'
import type {
  CalendarMatchDto,
  CalendarMatchState,
  CalendarMatchesResponse,
  GasCalendarGetMatchesV2Response,
  GasCalendarMatchV2,
} from '../contracts/calendar.contract'

function recordKeyForMatch(encuentroId: string, referenciaEncuentro: string): string {
  const ref = referenciaEncuentro.trim()
  if (ref) return `${encuentroId}::ref::${ref}`
  return encuentroId
}

/** Clave estable del mapa de calendario (incluye sufijo Fase II cuando hay referencia). */
export function calendarRecordKeyForDto(
  m: Pick<CalendarMatchDto, 'encuentroId' | 'referenciaEncuentro'>,
): string {
  return recordKeyForMatch(m.encuentroId, m.referenciaEncuentro)
}

/** Valores canónicos que ya devuelve el boundary GAS; el cliente no reinterpreta alias de negocio. */
const ESTADOS_PARTIDO_ACEPTADOS: ReadonlySet<string> = new Set([
  'sin_alineacion',
  'alineacion_parcial',
  'acta_abierta',
  'acta_cerrada',
  'unspecified',
])

/** Valida string del boundary; si no coincide con valores canónicos conocidos → `unspecified`. */
function estadoPartidoDtoFromBoundary(value: unknown): CalendarMatchState {
  if (typeof value !== 'string') return 'unspecified'
  const s = value.trim()
  return ESTADOS_PARTIDO_ACEPTADOS.has(s) ? (s as CalendarMatchState) : 'unspecified'
}

function isGasMatchV2(x: unknown): x is GasCalendarMatchV2 {
  if (x == null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.idEncuentro === 'string' &&
    typeof o.grupo === 'string' &&
    typeof o.equipoLocal === 'string' &&
    typeof o.equipoVisitante === 'string' &&
    typeof o.hora === 'string' &&
    typeof o.campo === 'string' &&
    typeof o.resultado === 'string' &&
    typeof o.estadoAlineaciones === 'string' &&
    typeof o.estadoPartido === 'string' &&
    typeof o.referenciaEncuentro === 'string'
  )
}

function gasMatchV2ToDto(m: GasCalendarMatchV2): CalendarMatchDto {
  return {
    encuentroId: m.idEncuentro,
    grupo: m.grupo,
    equipoLocal: m.equipoLocal,
    equipoVisitante: m.equipoVisitante,
    hora: m.hora,
    campo: m.campo,
    resultadoDisplay: m.resultado,
    estadoAlineacionesDisplay: m.estadoAlineaciones,
    estadoPartido: estadoPartidoDtoFromBoundary(m.estadoPartido),
    referenciaEncuentro: m.referenciaEncuentro,
  }
}

/**
 * Adapta la respuesta de `calendar_getMatches_v2` al contrato interno de la SPA.
 */
export function adaptCalendarGetMatchesV2Response(raw: unknown): CalendarMatchesResponse {
  const out: Record<string, CalendarMatchDto> = {}

  if (raw == null || typeof raw !== 'object') {
    log.warn('calendar.adapter.boundaryUnexpected', {
      reason: 'null_or_non_object',
    })
    return { schemaVersion: 2, matchesByEncuentroId: out }
  }

  const body = raw as Partial<GasCalendarGetMatchesV2Response>
  if (body.version !== 2 || !Array.isArray(body.matches)) {
    log.warn('calendar.adapter.boundaryUnexpected', {
      reason: 'not_v2_matches',
      version: body.version,
      matchesType: body.matches == null ? 'nullish' : typeof body.matches,
    })
    return { schemaVersion: 2, matchesByEncuentroId: out }
  }

  for (const item of body.matches) {
    if (!isGasMatchV2(item)) continue
    const dto = gasMatchV2ToDto(item)
    const key = recordKeyForMatch(dto.encuentroId, dto.referenciaEncuentro)
    out[key] = dto
  }

  return {
    schemaVersion: 2,
    matchesByEncuentroId: out,
  }
}
