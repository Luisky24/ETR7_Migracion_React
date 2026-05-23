import { describe, expect, it } from 'vitest'
import {
  isCopaCloseApplicable,
  isRankingFinalExcluded,
  validateCopaClose,
} from '../domain/copa'

const baseCtx = {
  phase: 'Fase II' as const,
  isCopaGroup: true,
  identificacionEncuentro: 'SF1 Semifinal',
  score: { local: 10, visitante: 5 },
  placeholdersResolved: { ganadorFound: true, perdedorFound: true },
}

describe('copa', () => {
  it('aplica COPA solo Fase II y grupo COPA', () => {
    expect(isCopaCloseApplicable(baseCtx)).toBe(true)
    expect(
      isCopaCloseApplicable({ ...baseCtx, phase: 'Fase I' }),
    ).toBe(false)
  })

  it('excluye ranking final y cruces 3/4', () => {
    expect(isRankingFinalExcluded('Final Oro')).toBe(true)
    expect(isRankingFinalExcluded('SF1 Semifinal')).toBe(false)
    expect(isRankingFinalExcluded('3/4 puesto')).toBe(true)
  })

  it('COPA válida con ganador y placeholders', () => {
    const result = validateCopaClose(baseCtx)
    expect(result.ok).toBe(true)
  })

  it('COPA inválida en empate', () => {
    const result = validateCopaClose({
      ...baseCtx,
      score: { local: 10, visitante: 10 },
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0]?.code).toBe('COPA_DRAW_NOT_ALLOWED')
  })

  it('COPA inválida sin placeholders', () => {
    const result = validateCopaClose({
      ...baseCtx,
      placeholdersResolved: { ganadorFound: false, perdedorFound: true },
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0]?.code).toBe('COPA_PLACEHOLDER_NOT_FOUND')
  })

  it('no valida COPA si ranking final excluido', () => {
    const result = validateCopaClose({
      ...baseCtx,
      identificacionEncuentro: 'Final',
    })
    expect(result.ok).toBe(true)
  })
})
