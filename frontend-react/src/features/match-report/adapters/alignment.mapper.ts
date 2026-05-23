/**
 * Wire GAS alineación/acta → MatchTeam (snapshot read-only).
 */

import type { MatchTeam, PlayerMatchLine, TeamSide, TeamTotals } from '../contracts'
import type { GasTeamLineupWire, LegacyJugadorFields } from '../contracts/matchReport.wire'
import { buildPlayerId } from '../utils/playerRowKeys'

const JUG = {
  nombre: 0,
  titular: 1,
  suplente: 2,
  capitan: 3,
  dorsal: 4,
  E: 5,
  T: 6,
  PC: 7,
  Tar: 8,
} as const

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '0'), 10)
  return Number.isFinite(n) ? n : 0
}

function str(v: unknown): string {
  return v != null ? String(v).trim() : ''
}

/** Parsea una fila `jugador[]` legacy a campos nombrados. */
export function parseLegacyJugadorRow(raw: unknown): LegacyJugadorFields | null {
  if (!Array.isArray(raw) || raw.length < 5) return null
  const hasActaStats = raw.length >= 9
  return {
    nombre: str(raw[JUG.nombre]),
    titular: str(raw[JUG.titular]),
    suplente: str(raw[JUG.suplente]),
    capitan: str(raw[JUG.capitan]),
    dorsal: num(raw[JUG.dorsal]),
    E: hasActaStats ? num(raw[JUG.E]) : 0,
    T: hasActaStats ? num(raw[JUG.T]) : 0,
    PC: hasActaStats ? num(raw[JUG.PC]) : 0,
    Tar: hasActaStats ? num(raw[JUG.Tar]) : 0,
    hasActaStats,
  }
}

function isTitularOrSuplente(j: LegacyJugadorFields): boolean {
  return j.titular.toUpperCase() === 'X' || j.suplente.toUpperCase() === 'X'
}

function mapPlayerLine(j: LegacyJugadorFields): PlayerMatchLine {
  return {
    playerId: buildPlayerId(j.dorsal, j.nombre),
    jugador: j.nombre,
    dorsal: j.dorsal,
    isTitularOrSuplente: isTitularOrSuplente(j),
    isCaptain: j.capitan.toUpperCase() === 'X',
    actions: { E: j.E, T: j.T, PC: j.PC, Tar: j.Tar },
  }
}

const EMPTY_TOTALS: TeamTotals = { E: 0, T: 0, PC: 0, Tar: 0 }

function isGasTeamLineupWire(x: unknown): x is GasTeamLineupWire {
  if (x == null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return Array.isArray(o.jugadores) && o.jugadores.every((row) => row == null || Array.isArray(row))
}

/** Mapea alineación GAS a equipo de dominio (jugadores en snapshot, sin edición de plantilla). */
export function mapGasTeamLineupToMatchTeam(
  wire: unknown,
  side: TeamSide,
  fallbackEquipo: string,
): MatchTeam | null {
  if (!isGasTeamLineupWire(wire)) return null

  const players: PlayerMatchLine[] = []

  for (const row of wire.jugadores) {
    const parsed = parseLegacyJugadorRow(row)
    if (!parsed || !parsed.nombre) continue
    if (!isTitularOrSuplente(parsed)) continue
    players.push(mapPlayerLine(parsed))
  }

  return {
    side,
    equipo: str(wire.equipo) || fallbackEquipo,
    delegado: str(wire.delegado),
    entrenador: str(wire.entrenador),
    players,
    totals: EMPTY_TOTALS,
    classification: { P: 0, BO: 0, BD: 0, Total: 0 },
    observaciones: str(wire.observaciones),
  }
}

/** Indica si el wire de equipo incluye estadísticas de acta persistidas. */
export function teamWireHasActaStats(wire: unknown): boolean {
  if (!isGasTeamLineupWire(wire)) return false
  for (const row of wire.jugadores) {
    const j = parseLegacyJugadorRow(row)
    if (j?.hasActaStats) return true
  }
  return false
}
