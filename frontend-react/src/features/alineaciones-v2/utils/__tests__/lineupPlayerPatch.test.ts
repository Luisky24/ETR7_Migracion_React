import { describe, expect, it } from 'vitest'
import type { TeamLineupPlayerDto } from '../../contracts/teamLineupContext.contract'
import {
  computeDuplicateDorsals,
  isDorsalInvalidForPlayer,
  normalizePlayerRosterRoles,
  parseDorsalInput,
  setPlayerDorsal,
  toggleCapitan,
  toggleSuplente,
  toggleTitular,
} from '../lineupPlayerPatch'
import { player } from './lineupTestFixtures'

function roster(...jugadores: TeamLineupPlayerDto[]): TeamLineupPlayerDto[] {
  return jugadores
}

describe('normalizePlayerRosterRoles', () => {
  it('quita capitán si no es titular', () => {
    const p = player('A', { suplente: true, capitan: true })
    expect(normalizePlayerRosterRoles(p).capitan).toBe(false)
  })

  it('limpia dorsal sin rol en cancha', () => {
    const p = player('A', { dorsal: 9 })
    expect(normalizePlayerRosterRoles(p).dorsal).toBeNull()
  })
})

describe('toggleTitular', () => {
  it('activa titular y desmarca suplente', () => {
    const base = roster(player('A', { suplente: true }), player('B'))
    const next = toggleTitular(base, 1)
    expect(next[1]?.titular).toBe(true)
    expect(next[1]?.suplente).toBe(false)
  })

  it('al desactivar titular quita capitán', () => {
    const base = roster(player('A', { titular: true, capitan: true, dorsal: 1 }))
    const next = toggleTitular(base, 0)
    expect(next[0]?.titular).toBe(false)
    expect(next[0]?.capitan).toBe(false)
  })

  it('no muta el array original', () => {
    const base = roster(player('A'))
    const snapshot = structuredClone(base)
    toggleTitular(base, 0)
    expect(base).toEqual(snapshot)
  })

  it('índice fuera de rango devuelve copia normalizada sin cambios de rol', () => {
    const base = roster(player('A', { titular: true, dorsal: 3 }))
    const next = toggleTitular(base, 99)
    expect(next).toEqual(base)
    expect(next).not.toBe(base)
  })
})

describe('toggleSuplente', () => {
  it('activa suplente y desmarca titular y capitán', () => {
    const base = roster(player('A', { titular: true, capitan: true, dorsal: 1 }))
    const next = toggleSuplente(base, 0)
    expect(next[0]?.suplente).toBe(true)
    expect(next[0]?.titular).toBe(false)
    expect(next[0]?.capitan).toBe(false)
  })

  it('al desactivar suplente limpia dorsal', () => {
    const base = roster(player('A', { suplente: true, dorsal: 5 }))
    const next = toggleSuplente(base, 0)
    expect(next[0]?.suplente).toBe(false)
    expect(next[0]?.dorsal).toBeNull()
  })
})

describe('toggleCapitan', () => {
  it('solo permite un capitán entre titulares', () => {
    const base = roster(
      player('A', { titular: true, capitan: true, dorsal: 1 }),
      player('B', { titular: true, dorsal: 2 }),
    )
    const next = toggleCapitan(base, 1)
    expect(next[0]?.capitan).toBe(false)
    expect(next[1]?.capitan).toBe(true)
  })

  it('no asigna capitán a no titular', () => {
    const base = roster(player('A', { suplente: true, dorsal: 3 }))
    const next = toggleCapitan(base, 0)
    expect(next.every((p) => !p.capitan)).toBe(true)
  })

  it('desmarca capitán si ya lo era', () => {
    const base = roster(player('A', { titular: true, capitan: true, dorsal: 1 }))
    const next = toggleCapitan(base, 0)
    expect(next[0]?.capitan).toBe(false)
  })
})

describe('setPlayerDorsal', () => {
  it('asigna dorsal en índice válido', () => {
    const base = roster(player('A', { titular: true }))
    const next = setPlayerDorsal(base, 0, 10)
    expect(next[0]?.dorsal).toBe(10)
  })

  it('normaliza dorsal en jugador sin rol', () => {
    const base = roster(player('A'))
    const next = setPlayerDorsal(base, 0, 10)
    expect(next[0]?.dorsal).toBeNull()
  })
})

describe('parseDorsalInput', () => {
  it('acepta 1–99 y rechaza vacío o fuera de rango', () => {
    expect(parseDorsalInput('7')).toBe(7)
    expect(parseDorsalInput('99')).toBe(99)
    expect(parseDorsalInput('')).toBeNull()
    expect(parseDorsalInput('abc')).toBeNull()
    expect(parseDorsalInput('100')).toBeNull()
  })
})

describe('computeDuplicateDorsals', () => {
  it('detecta duplicados solo entre jugadores en cancha', () => {
    const jugadores = roster(
      player('A', { titular: true, dorsal: 1 }),
      player('B', { titular: true, dorsal: 1 }),
      player('C', { dorsal: 1 }),
    )
    expect(computeDuplicateDorsals(jugadores).has(1)).toBe(true)
  })
})

describe('isDorsalInvalidForPlayer', () => {
  it('no exige dorsal en banquillo sin rol', () => {
    expect(isDorsalInvalidForPlayer(player('A'))).toBe(false)
  })

  it('exige dorsal válido en cancha', () => {
    expect(isDorsalInvalidForPlayer(player('A', { titular: true }))).toBe(true)
    expect(isDorsalInvalidForPlayer(player('A', { titular: true, dorsal: 5 }))).toBe(false)
  })
})
