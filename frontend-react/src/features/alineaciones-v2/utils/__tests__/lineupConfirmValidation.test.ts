import { describe, expect, it } from 'vitest'
import {
  LINEUP_CONFIRM_MAX_SUPLENTES,
  LINEUP_CONFIRM_REQUIRED_TITULARES,
} from '../lineupDomain.constants'
import { computeLineupConfirmBlockingErrors } from '../lineupConfirmValidation'
import { player, validConfirmRoster } from './lineupTestFixtures'

describe('computeLineupConfirmBlockingErrors', () => {
  it('sin errores con alineación válida', () => {
    const errors = computeLineupConfirmBlockingErrors({
      delegado: 'Delegado',
      entrenador: 'Entrenador',
      jugadores: validConfirmRoster(),
    })
    expect(errors).toEqual([])
  })

  it('exige delegado y entrenador', () => {
    expect(
      computeLineupConfirmBlockingErrors({
        delegado: '',
        entrenador: '',
        jugadores: validConfirmRoster(),
      }),
    ).toContain('Debe indicarse un delegado y un entrenador para confirmar la alineación.')

    expect(
      computeLineupConfirmBlockingErrors({
        delegado: '   ',
        entrenador: 'Coach',
        jugadores: validConfirmRoster(),
      }),
    ).toContain('Debe indicarse un delegado para confirmar la alineación.')
  })

  it(`exige exactamente ${String(LINEUP_CONFIRM_REQUIRED_TITULARES)} titulares`, () => {
    const jugadores = validConfirmRoster().map((j, i) =>
      i === 0 ? { ...j, titular: false, suplente: true } : j,
    )
    const errors = computeLineupConfirmBlockingErrors({
      delegado: 'D',
      entrenador: 'E',
      jugadores,
    })
    expect(errors.some((e) => e.includes('exactamente 7 titulares'))).toBe(true)
  })

  it(`rechaza más de ${String(LINEUP_CONFIRM_MAX_SUPLENTES)} suplentes`, () => {
    const titulares = Array.from({ length: 7 }, (_, i) =>
      player(`T${String(i)}`, { titular: true, dorsal: i + 1, capitan: i === 0 }),
    )
    const suplentes = Array.from({ length: 6 }, (_, i) =>
      player(`S${String(i)}`, { suplente: true, dorsal: 20 + i }),
    )
    const errors = computeLineupConfirmBlockingErrors({
      delegado: 'D',
      entrenador: 'E',
      jugadores: [...titulares, ...suplentes],
    })
    expect(errors.some((e) => e.includes('Máximo 5 suplentes'))).toBe(true)
  })

  it('exige exactamente un capitán', () => {
    const jugadores = validConfirmRoster().map((j) => ({ ...j, capitan: false }))
    const errors = computeLineupConfirmBlockingErrors({
      delegado: 'D',
      entrenador: 'E',
      jugadores,
    })
    expect(errors.some((e) => e.includes('exactamente 1 capitán'))).toBe(true)
  })

  it('rechaza titular y suplente simultáneos', () => {
    const jugadores = validConfirmRoster().map((j, i) =>
      i === 0 ? { ...j, suplente: true } : j,
    )
    const errors = computeLineupConfirmBlockingErrors({
      delegado: 'D',
      entrenador: 'E',
      jugadores,
    })
    expect(errors.some((e) => e.includes('titular y suplente'))).toBe(true)
  })

  it('rechaza dorsal inválido y duplicado', () => {
    const jugadores = validConfirmRoster().map((j, i) => {
      if (i === 1) return { ...j, dorsal: null }
      if (i === 2) return { ...j, dorsal: 1 }
      return j
    })
    const errors = computeLineupConfirmBlockingErrors({
      delegado: 'D',
      entrenador: 'E',
      jugadores,
    })
    expect(errors.some((e) => e.includes('dorsal obligatorio'))).toBe(true)
    expect(errors.some((e) => e.includes('duplicado'))).toBe(true)
  })
})
