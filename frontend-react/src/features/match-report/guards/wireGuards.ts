/**
 * Validación de frontera GAS — antes de mapear a dominio React.
 */

import type { CalendarMatchDto } from '@/features/calendar/contracts/calendar.contract'
import type { MatchContext } from '../contracts'
import type { GasGuardarActaResult, GasObtenerAlineacionesResponse, GasTeamLineupWire } from '../contracts/matchReport.wire'
import { matchReportRuntimeLog } from '../utils/runtimeLogger'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string'
}

function isGasTeamLineupWire(x: unknown): x is GasTeamLineupWire {
  if (x == null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return Array.isArray(o.jugadores)
}

/** Valida respuesta de `obtenerAlineacionesSPA` ([local, visitante] o [local, visitante, metadata]). */
export function isValidMatchReportWire(
  raw: unknown,
): raw is GasObtenerAlineacionesResponse | readonly [unknown, unknown, unknown] {
  if (!Array.isArray(raw) || raw.length < 2) {
    matchReportRuntimeLog.guard('matchReportWire.invalid', { reason: 'not_array_or_short' })
    return false
  }
  const [local, visit] = raw
  if (!isGasTeamLineupWire(local) || !isGasTeamLineupWire(visit)) {
    matchReportRuntimeLog.guard('matchReportWire.invalid', { reason: 'team_shape' })
    return false
  }
  if (local.jugadores.length === 0 && visit.jugadores.length === 0) {
    matchReportRuntimeLog.guard('matchReportWire.incomplete', { reason: 'empty_rosters' })
    return false
  }
  if (raw.length > 3) {
    matchReportRuntimeLog.guard('matchReportWire.invalid', { reason: 'array_too_long' })
    return false
  }
  return true
}

/** Valida DTO de calendario mínimo para contexto de acta. */
export function isValidCalendarDto(match: unknown): match is CalendarMatchDto {
  if (match == null || typeof match !== 'object') return false
  const m = match as Record<string, unknown>
  return (
    isNonEmptyString(m.encuentroId) &&
    isNonEmptyString(m.equipoLocal) &&
    isNonEmptyString(m.equipoVisitante)
  )
}

/** Valida alineación wire individual. */
export function isValidAlignmentDto(wire: unknown): wire is GasTeamLineupWire {
  return isGasTeamLineupWire(wire)
}

/** Valida respuesta de guardar/cerrar acta. */
export function isValidPersistenceResponse(raw: unknown): raw is GasGuardarActaResult {
  if (raw == null || typeof raw !== 'object') {
    matchReportRuntimeLog.guard('persistenceResponse.invalid', { reason: 'nullish' })
    return false
  }
  const o = raw as Record<string, unknown>
  if ('ok' in o && o.ok === false) {
    matchReportRuntimeLog.guard('persistenceResponse.rejected', {})
    return false
  }
  return true
}

/** Valida MatchContext antes de operaciones. */
export function isValidMatchContext(context: unknown): context is MatchContext {
  if (context == null || typeof context !== 'object') return false
  const c = context as Record<string, unknown>
  return (
    (c.category === 'M' || c.category === 'F') &&
    (c.phase === 'Fase I' || c.phase === 'Fase II') &&
    isNonEmptyString(c.encuentroId) &&
    isNonEmptyString(c.equipoLocal) &&
    isNonEmptyString(c.equipoVisitante)
  )
}
