import { describe, expect, it } from 'vitest'
import { areLineupDraftsEqual, cloneLineupDraft } from '../lineupDraftCompare'
import { draft, player } from './lineupTestFixtures'

describe('cloneLineupDraft', () => {
  it('crea copia profunda independiente', () => {
    const original = draft({
      delegado: 'D',
      entrenador: 'E',
      jugadores: [player('A', { titular: true, dorsal: 1 })],
    })
    const cloned = cloneLineupDraft(original)
    const mutated: typeof cloned = {
      ...cloned,
      jugadores: [{ ...cloned.jugadores[0]!, dorsal: 99 }],
    }
    expect(mutated.jugadores[0]?.dorsal).toBe(99)
    expect(original.jugadores[0]?.dorsal).toBe(1)
    expect(cloned).not.toBe(original)
    expect(cloned.jugadores).not.toBe(original.jugadores)
  })
})

describe('areLineupDraftsEqual', () => {
  it('draft equivalente tras clone', () => {
    const a = draft({
      delegado: 'D',
      entrenador: 'E',
      jugadores: [player('A', { titular: true, dorsal: 1 })],
    })
    const b = cloneLineupDraft(a)
    expect(areLineupDraftsEqual(a, b)).toBe(true)
  })

  it('detecta cambio real (dirty)', () => {
    const a = draft({ delegado: 'D', jugadores: [player('A')] })
    const b = draft({ delegado: 'D', jugadores: [player('A', { titular: true })] })
    expect(areLineupDraftsEqual(a, b)).toBe(false)
  })

  it('dorsal null en ambos es igual', () => {
    const a = draft({ jugadores: [player('A', { dorsal: null })] })
    const b = draft({ jugadores: [player('A', { dorsal: null })] })
    expect(areLineupDraftsEqual(a, b)).toBe(true)
  })

  it('dorsal null vs número es distinto', () => {
    const a = draft({ jugadores: [player('A', { dorsal: null })] })
    const b = draft({ jugadores: [player('A', { dorsal: 5 })] })
    expect(areLineupDraftsEqual(a, b)).toBe(false)
  })

  it('strings vacíos equivalentes en staff', () => {
    const a = draft({ delegado: '', entrenador: '' })
    const b = draft({ delegado: '', entrenador: '' })
    expect(areLineupDraftsEqual(a, b)).toBe(true)
  })

  it('longitud de plantilla distinta no es igual', () => {
    const a = draft({ jugadores: [player('A')] })
    const b = draft({ jugadores: [player('A'), player('B')] })
    expect(areLineupDraftsEqual(a, b)).toBe(false)
  })

  it('orden de jugadores importa (comparación por índice)', () => {
    const a = draft({ jugadores: [player('A'), player('B')] })
    const b = draft({ jugadores: [player('B'), player('A')] })
    expect(areLineupDraftsEqual(a, b)).toBe(false)
  })
})
