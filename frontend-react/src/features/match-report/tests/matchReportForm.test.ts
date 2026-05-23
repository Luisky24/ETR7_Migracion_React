import { describe, expect, it } from 'vitest'
import { teamConversionsExceedTriesMessage } from '../domain/validation'
import { playerActionFieldKey } from '../types/matchReportForm.types'
import { validateActionInputPatch } from '../validators/uiValidators'
import { emptyMatchReport, playerLine } from './fixtures'

describe('match report form model', () => {
  it('playerActionFieldKey compone clave estable', () => {
    expect(playerActionFieldKey('local', 'p-1', 'E')).toBe('local:p-1:E')
  })

  it('validateActionInputPatch rechaza negativos', () => {
    expect(validateActionInputPatch({ E: -1 })).toMatch(/inválido/i)
  })

  it('validateActionInputPatch acepta cero', () => {
    expect(validateActionInputPatch({ T: 0 })).toBeNull()
  })

  it('validateActionInputPatch rechaza valores > 99', () => {
    expect(validateActionInputPatch({ PC: 100 })).toMatch(/inválido/i)
  })

  it('validateActionInputPatch no valida T vs E por fila (regla agregada en dominio)', () => {
    expect(validateActionInputPatch({ T: 2, E: 1 })).toBeNull()
  })

  it('teamConversionsExceedTriesMessage refleja totales equipo', () => {
    const report = emptyMatchReport()
    const teamValid = {
      ...report.local,
      players: [
        playerLine('A', 1, { E: 1, T: 0 }, { titular: true }),
        playerLine('B', 2, { E: 0, T: 1 }, { titular: true }),
      ],
    }
    expect(teamConversionsExceedTriesMessage(teamValid)).toBeNull()

    const teamInvalid = {
      ...report.local,
      players: [
        playerLine('A', 1, { E: 0, T: 1 }, { titular: true }),
        playerLine('B', 2, { E: 0, T: 1 }, { titular: true }),
      ],
    }
    expect(teamConversionsExceedTriesMessage(teamInvalid)).toMatch(/equipo/i)
  })
})
