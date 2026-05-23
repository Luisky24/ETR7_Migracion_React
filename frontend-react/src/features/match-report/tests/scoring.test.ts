import { describe, expect, it } from 'vitest'
import {
  computeFullMatchScoring,
  computeMatchScoreFromTotals,
  computeTeamScoreFromTotals,
  recalculateMatchReport,
  resolveMatchResult,
} from '../domain/scoring'
import { emptyMatchReport, playerLine } from './fixtures'

describe('scoring', () => {
  it('calcula PF desde ensayos, transformaciones y puntos de castigo', () => {
    const totals = { E: 2, T: 1, PC: 1, Tar: 0 }
    expect(computeTeamScoreFromTotals(totals)).toBe(2 * 5 + 1 * 2 + 1 * 3)
    expect(computeTeamScoreFromTotals(totals)).toBe(15)
  })

  it('tarjetas no suman al marcador', () => {
    const totals = { E: 0, T: 0, PC: 0, Tar: 3 }
    expect(computeTeamScoreFromTotals(totals)).toBe(0)
  })

  it('desglosa tries y puntos de castigo en breakdown', () => {
    const scoring = computeFullMatchScoring(
      [playerLine('A', 1, { E: 1, T: 1, PC: 1 })],
      [playerLine('B', 2, { E: 0, T: 0, PC: 0 })],
    )
    expect(scoring.local.tries).toBe(1)
    expect(scoring.local.conversions).toBe(1)
    expect(scoring.local.penaltyKicks).toBe(1)
    expect(scoring.local.pointsFor).toBe(10)
    expect(scoring.visitante.pointsFor).toBe(0)
    expect(scoring.score).toEqual({ local: 10, visitante: 0 })
  })

  it('resuelve resultado victoria local, visitante y empate', () => {
    expect(resolveMatchResult({ local: 12, visitante: 7 })).toBe('local_win')
    expect(resolveMatchResult({ local: 3, visitante: 15 })).toBe('visitante_win')
    expect(resolveMatchResult({ local: 10, visitante: 10 })).toBe('draw')
  })

  it('recalculateMatchReport actualiza marcador y totals en equipos', () => {
    const report = emptyMatchReport()
    const withAction = recalculateMatchReport({
      ...report,
      local: {
        ...report.local,
        players: [playerLine('Try', 1, { E: 2 }, { titular: true })],
      },
    })
    expect(withAction.score.local).toBe(10)
    expect(withAction.local.totals.E).toBe(2)
    expect(withAction.local.classification.P).toBe(3)
    expect(withAction.visitante.classification.P).toBe(0)
  })

  it('marcador desde totals sin jugadores en cancha no cuenta', () => {
    const report = emptyMatchReport()
    const nonField = recalculateMatchReport({
      ...report,
      local: {
        ...report.local,
        players: [playerLine('Bench', 99, { E: 5 }, { titular: false })],
      },
    })
    expect(nonField.score.local).toBe(0)
  })

  it('computeMatchScoreFromTotals para empate 14-14', () => {
    const score = computeMatchScoreFromTotals(
      { E: 2, T: 2, PC: 0, Tar: 0 },
      { E: 2, T: 2, PC: 0, Tar: 0 },
    )
    expect(score).toEqual({ local: 14, visitante: 14 })
  })
})
