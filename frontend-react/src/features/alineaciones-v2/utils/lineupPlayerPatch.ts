import type { TeamLineupPlayerDto } from '../contracts/teamLineupContext.contract'
import { LINEUP_DORSAL_MAX, LINEUP_DORSAL_MIN } from './lineupDomain.constants'

/** Capitán solo en titular; dorsal solo si hay rol en cancha. */
export function normalizePlayerRosterRoles(p: TeamLineupPlayerDto): TeamLineupPlayerDto {
  let out = p
  if (!out.titular && out.capitan) {
    out = { ...out, capitan: false }
  }
  if (!out.titular && !out.suplente) {
    out = { ...out, dorsal: null }
  }
  return out
}

function mapRoster(
  jugadores: readonly TeamLineupPlayerDto[],
  mapIndex: (p: TeamLineupPlayerDto, i: number) => TeamLineupPlayerDto,
): TeamLineupPlayerDto[] {
  return jugadores.map((p, i) => normalizePlayerRosterRoles(mapIndex(p, i)))
}

function rosterIndexInBounds(jugadores: readonly TeamLineupPlayerDto[], index: number): boolean {
  return index >= 0 && index < jugadores.length
}

/**
 * Alterna titular: activa (desmarca suplente) o desactiva (capitán y dorsal si sin rol).
 */
export function toggleTitular(jugadores: readonly TeamLineupPlayerDto[], index: number): TeamLineupPlayerDto[] {
  if (!rosterIndexInBounds(jugadores, index)) {
    return mapRoster(jugadores, (p) => p)
  }
  return mapRoster(jugadores, (p, i) => {
    if (i !== index) return p
    if (p.titular) {
      return { ...p, titular: false, capitan: false }
    }
    return { ...p, titular: true, suplente: false }
  })
}

/**
 * Alterna suplente: activa (desmarca titular y capitán) o desactiva (dorsal si sin rol).
 */
export function toggleSuplente(jugadores: readonly TeamLineupPlayerDto[], index: number): TeamLineupPlayerDto[] {
  if (!rosterIndexInBounds(jugadores, index)) {
    return mapRoster(jugadores, (p) => p)
  }
  return mapRoster(jugadores, (p, i) => {
    if (i !== index) return p
    if (p.suplente) {
      return { ...p, suplente: false }
    }
    return { ...p, suplente: true, titular: false, capitan: false }
  })
}

/**
 * Un único capitán; solo si el jugador es titular.
 */
export function toggleCapitan(jugadores: readonly TeamLineupPlayerDto[], index: number): TeamLineupPlayerDto[] {
  if (!rosterIndexInBounds(jugadores, index)) {
    return mapRoster(jugadores, (p) => p)
  }
  const target = jugadores[index]!
  if (target.capitan) {
    return jugadores.map((p, i) => normalizePlayerRosterRoles(i === index ? { ...p, capitan: false } : p))
  }
  if (!target.titular) {
    return jugadores.map((p) => normalizePlayerRosterRoles(p))
  }
  return jugadores.map((p, i) =>
    normalizePlayerRosterRoles({
      ...p,
      capitan: i === index,
    }),
  )
}

/** Dorsal 1–99 o null si vacío / inválido (sin truncar: 100 → inválido). */
export function parseDorsalInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '')
  if (digits === '') return null
  const n = parseInt(digits, 10)
  if (Number.isNaN(n) || n < LINEUP_DORSAL_MIN || n > LINEUP_DORSAL_MAX) return null
  return n
}

export function setPlayerDorsal(
  jugadores: readonly TeamLineupPlayerDto[],
  index: number,
  dorsal: number | null,
): TeamLineupPlayerDto[] {
  if (!rosterIndexInBounds(jugadores, index)) {
    return mapRoster(jugadores, (p) => p)
  }
  return mapRoster(jugadores, (p, i) => (i === index ? { ...p, dorsal } : p))
}

/** Dorsales duplicados entre jugadores con rol en cancha (titular/suplente). */
export function computeDuplicateDorsals(jugadores: readonly TeamLineupPlayerDto[]): ReadonlySet<number> {
  const seen = new Map<number, number>()
  const dupes = new Set<number>()
  for (const j of jugadores) {
    if (!j.titular && !j.suplente) continue
    if (j.dorsal == null || j.dorsal < LINEUP_DORSAL_MIN || j.dorsal > LINEUP_DORSAL_MAX) continue
    const prev = seen.get(j.dorsal)
    if (prev !== undefined) {
      dupes.add(j.dorsal)
    } else {
      seen.set(j.dorsal, 1)
    }
  }
  return dupes
}

/** Dorsal fuera de rango para quien está en cancha. */
export function isDorsalInvalidForPlayer(j: TeamLineupPlayerDto): boolean {
  if (!j.titular && !j.suplente) return false
  return j.dorsal == null || j.dorsal < LINEUP_DORSAL_MIN || j.dorsal > LINEUP_DORSAL_MAX
}
