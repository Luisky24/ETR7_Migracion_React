import { describe, expect, it } from 'vitest'
import {
  isValidAlignmentDto,
  isValidCalendarDto,
  isValidMatchContext,
  isValidMatchReportWire,
  isValidPersistenceResponse,
} from '../guards'
import { baseContext } from './fixtures'

describe('wireGuards', () => {
  it('validates match report wire', () => {
    const wire = [
      { equipo: 'L', delegado: '', entrenador: '', jugadores: [['J', 'X', '', '', 1]] },
      { equipo: 'V', delegado: '', entrenador: '', jugadores: [['K', 'X', '', '', 2]] },
    ]
    expect(isValidMatchReportWire(wire)).toBe(true)
    expect(isValidMatchReportWire([null, null])).toBe(false)
    expect(isValidMatchReportWire([])).toBe(false)
  })

  it('validates calendar dto', () => {
    expect(
      isValidCalendarDto({
        encuentroId: 'A|L|V',
        equipoLocal: 'L',
        equipoVisitante: 'V',
      }),
    ).toBe(true)
    expect(isValidCalendarDto({})).toBe(false)
  })

  it('validates alignment dto', () => {
    expect(isValidAlignmentDto({ jugadores: [] })).toBe(true)
    expect(isValidAlignmentDto(null)).toBe(false)
  })

  it('validates persistence response', () => {
    expect(isValidPersistenceResponse({ ok: true })).toBe(true)
    expect(isValidPersistenceResponse({ ok: false })).toBe(false)
    expect(isValidPersistenceResponse(null)).toBe(false)
  })

  it('validates match context', () => {
    expect(isValidMatchContext(baseContext())).toBe(true)
    expect(isValidMatchContext({ category: 'X' })).toBe(false)
  })
})
