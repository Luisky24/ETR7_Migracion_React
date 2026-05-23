import { describe, expect, it } from 'vitest'
import {
  applyGasOfficialClassification,
  computeClientClassificationPreview,
  qualifiesForDefensiveBonus,
} from '../domain/classification'

describe('classification', () => {
  it('victoria local: P 3-0 y bonus defensivo visitante si diff 1-7', () => {
    const { local, visitante } = computeClientClassificationPreview(
      { local: 12, visitante: 7 },
      { hasAnyAction: true },
    )
    expect(local).toEqual({ P: 3, BO: 0, BD: 0, Total: 3 })
    expect(visitante).toEqual({ P: 0, BO: 0, BD: 1, Total: 1 })
  })

  it('derrota local estrecha: bonus defensivo local', () => {
    const { local } = computeClientClassificationPreview(
      { local: 5, visitante: 10 },
      { hasAnyAction: true },
    )
    expect(local.BD).toBe(1)
    expect(local.P).toBe(0)
  })

  it('empate: 2 puntos cada equipo', () => {
    const { local, visitante } = computeClientClassificationPreview(
      { local: 10, visitante: 10 },
      { hasAnyAction: true },
    )
    expect(local.P).toBe(2)
    expect(visitante.P).toBe(2)
    expect(local.Total).toBe(2)
  })

  it('sin acciones: clasificación preview a cero', () => {
    const { local, visitante } = computeClientClassificationPreview(
      { local: 0, visitante: 0 },
      { hasAnyAction: false },
    )
    expect(local.Total).toBe(0)
    expect(visitante.Total).toBe(0)
  })

  it('sin bonus defensivo si diff > 7', () => {
    const { visitante } = computeClientClassificationPreview(
      { local: 20, visitante: 10 },
      { hasAnyAction: true },
    )
    expect(visitante.BD).toBe(0)
  })

  it('BD con diferencia exacta 7 (margen < 8)', () => {
    const { visitante } = computeClientClassificationPreview(
      { local: 14, visitante: 7 },
      { hasAnyAction: true },
    )
    expect(qualifiesForDefensiveBonus(7)).toBe(true)
    expect(visitante.BD).toBe(1)
  })

  it('sin BD con diferencia exacta 8', () => {
    const { visitante } = computeClientClassificationPreview(
      { local: 15, visitante: 7 },
      { hasAnyAction: true },
    )
    expect(qualifiesForDefensiveBonus(8)).toBe(false)
    expect(visitante.BD).toBe(0)
  })

  it('empate: sin BD (diferencia 0)', () => {
    const { local, visitante } = computeClientClassificationPreview(
      { local: 10, visitante: 10 },
      { hasAnyAction: true },
    )
    expect(qualifiesForDefensiveBonus(0)).toBe(false)
    expect(local.BD).toBe(0)
    expect(visitante.BD).toBe(0)
  })

  it('victoria amplia: perdedor sin BD', () => {
    const { visitante } = computeClientClassificationPreview(
      { local: 30, visitante: 10 },
      { hasAnyAction: true },
    )
    expect(visitante.BD).toBe(0)
  })

  it('preview cliente mantiene BO=0', () => {
    const { local } = computeClientClassificationPreview(
      { local: 15, visitante: 0 },
      { hasAnyAction: true },
    )
    expect(local.BO).toBe(0)
  })

  it('clasificación oficial GAS F2 COPA aplica BO al ganador y anula perdedor', () => {
    const preview = computeClientClassificationPreview(
      { local: 12, visitante: 5 },
      { hasAnyAction: true },
    )
    const official = applyGasOfficialClassification({
      preview,
      score: { local: 12, visitante: 5 },
      phase: 'Fase II',
      isCopaGroup: true,
      f2BonusPoints: 2,
    })
    expect(official.local.BO).toBe(2)
    expect(official.local.Total).toBe(5)
    expect(official.visitante.BD).toBe(0)
    expect(official.visitante.Total).toBe(0)
  })

  it('clasificación oficial GAS sin COPA devuelve preview', () => {
    const preview = computeClientClassificationPreview(
      { local: 12, visitante: 5 },
      { hasAnyAction: true },
    )
    const official = applyGasOfficialClassification({
      preview,
      score: { local: 12, visitante: 5 },
      phase: 'Fase I',
      isCopaGroup: false,
    })
    expect(official).toEqual(preview)
  })
})
