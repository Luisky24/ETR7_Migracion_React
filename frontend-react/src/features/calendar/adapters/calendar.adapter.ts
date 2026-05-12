/**
 * Capa de adaptación GAS → contratos React.
 * Único módulo que orquesta parseo legacy + mappers posicionales.
 */

import type {
  CalendarCategory,
  CalendarPhase,
  CalendarMatchDto,
  CalendarMatchesResponse,
} from '../contracts/calendar.contract'
import { calendarMatchToDto } from '../mappers/calendar-domain-to-dto.mapper'
import { mapLegacyRowToCalendarMatch } from '../mappers/legacy-row-to-domain.mapper'
import { parseObtenerDatosInformacionPayload } from '../mappers/legacy-response.parse'

function recordKeyForMatch(encuentroId: string, referenciaEncuentro: string): string {
  const ref = referenciaEncuentro.trim()
  if (ref) return `${encuentroId}::ref::${ref}`
  return encuentroId
}

/**
 * Transforma la respuesta cruda de `obtenerDatosInformacion(..., "Calendario")` en DTOs.
 * No ejecuta llamadas de red.
 */
export function adaptObtenerDatosInformacionMatches(
  raw: unknown,
  ctx: { readonly categoria: CalendarCategory; readonly fase: CalendarPhase },
): CalendarMatchesResponse {
  const { rowsReadonly } = parseObtenerDatosInformacionPayload(raw)
  const out: Record<string, CalendarMatchDto> = {}

  for (const row of rowsReadonly) {
    const domain = mapLegacyRowToCalendarMatch(row, ctx)
    if (!domain) continue
    const dto = calendarMatchToDto(domain)
    const key = recordKeyForMatch(dto.encuentroId, dto.referenciaEncuentro)
    out[key] = dto
  }

  return {
    schemaVersion: 2,
    matchesByEncuentroId: out,
  }
}
