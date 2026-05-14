/**
 * Adaptador GAS → contratos React (alineaciones read-only).
 */

import { log } from '@/core/debug'
import type {
  GasAlineacionesGetMatchLineupsV2Response,
  GasMatchLineupPlayerV2,
  GasMatchLineupTeamV2,
  MatchLineupPlayerDto,
  MatchLineupTeamDto,
  MatchLineupsResponse,
} from '../contracts/alineaciones.contract'

function isGasPlayerV2(x: unknown): x is GasMatchLineupPlayerV2 {
  if (x == null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.nombre === 'string' &&
    typeof o.titular === 'boolean' &&
    typeof o.capitan === 'boolean' &&
    typeof o.dorsal === 'number' &&
    Number.isFinite(o.dorsal)
  )
}

function isGasTeamV2(x: unknown): x is GasMatchLineupTeamV2 {
  if (x == null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.teamName !== 'string' || !Array.isArray(o.jugadores)) return false
  for (const j of o.jugadores) {
    if (!isGasPlayerV2(j)) return false
  }
  if (o.entrenador !== undefined && typeof o.entrenador !== 'string') return false
  if (o.delegado !== undefined && typeof o.delegado !== 'string') return false
  return true
}

function playerDto(p: GasMatchLineupPlayerV2): MatchLineupPlayerDto {
  return {
    dorsal: p.dorsal,
    nombre: p.nombre,
    titular: p.titular,
    capitan: p.capitan,
  }
}

function teamDto(t: GasMatchLineupTeamV2): MatchLineupTeamDto {
  const jugadores = t.jugadores.map(playerDto)
  let out: MatchLineupTeamDto = {
    teamName: t.teamName,
    jugadores,
  }
  if (t.entrenador !== undefined && t.entrenador.trim() !== '') {
    out = { ...out, entrenador: t.entrenador }
  }
  if (t.delegado !== undefined && t.delegado.trim() !== '') {
    out = { ...out, delegado: t.delegado }
  }
  return out
}

export function adaptAlineacionesGetMatchLineupsV2Response(raw: unknown): MatchLineupsResponse | null {
  if (raw == null || typeof raw !== 'object') {
    log.warn('alineaciones.adapter.boundaryUnexpected', { reason: 'null_or_non_object' })
    return null
  }
  const body = raw as Partial<GasAlineacionesGetMatchLineupsV2Response>
  if (body.version !== 2 || typeof body.encuentroId !== 'string') {
    log.warn('alineaciones.adapter.boundaryUnexpected', {
      reason: 'not_v2_or_missing_id',
      version: body.version,
    })
    return null
  }
  if (!isGasTeamV2(body.local) || !isGasTeamV2(body.visitante)) {
    log.warn('alineaciones.adapter.boundaryUnexpected', { reason: 'invalid_teams' })
    return null
  }
  return {
    schemaVersion: 2,
    encuentroId: body.encuentroId,
    local: teamDto(body.local),
    visitante: teamDto(body.visitante),
  }
}
