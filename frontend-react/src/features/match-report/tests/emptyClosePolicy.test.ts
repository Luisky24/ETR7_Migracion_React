import { describe, expect, it } from 'vitest'
import { validateClose, validateFinalizeClose } from '../domain/validation'
import { buildCloseValidationInput, needsEmptyCloseConfirmation } from '../domain/finalization'
import { recalculateMatchReport } from '../domain/scoring'
import { isCopaCloseApplicable } from '../domain/copa'
import type { CopaCloseContext } from '../domain/copa'
import { baseContext, emptyMatchReport, playerLine } from './fixtures'

function copaDrawContext(report: ReturnType<typeof emptyMatchReport>): CopaCloseContext {
  return {
    phase: report.context.phase,
    isCopaGroup: true,
    identificacionEncuentro: 'Semifinal',
    score: report.score,
    placeholdersResolved: { ganadorFound: true, perdedorFound: true },
  }
}

describe('empty match close policy (QA-A4)', () => {
  it('needsEmptyCloseConfirmation detecta acta sin acciones', () => {
    expect(needsEmptyCloseConfirmation(emptyMatchReport())).toBe(true)
    const withAction = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 1 }, { titular: true })],
      },
    })
    expect(needsEmptyCloseConfirmation(withAction)).toBe(false)
  })

  it('marcador incoherente con acciones sigue bloqueando cierre', () => {
    let report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 2 }, { titular: true })],
      },
    })
    report = { ...report, score: { local: 0, visitante: 0 } }
    const result = validateClose(buildCloseValidationInput(report))
    expect(result.ok).toBe(true)
    expect(result.warnings.some((w) => w.code === 'SCORE_ACTION_MISMATCH')).toBe(true)
  })

  it('COPA en empate 0-0 sin acciones bloquea cierre', () => {
    const report = emptyMatchReport(
      baseContext({ phase: 'Fase II', referenciaEncuentro: 'REF-COPA' }),
    )
    const ctx = copaDrawContext(report)
    expect(isCopaCloseApplicable(ctx)).toBe(true)

    const result = validateClose(buildCloseValidationInput(report, ctx))
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'COPA_DRAW_NOT_ALLOWED')).toBe(true)
    expect(validateFinalizeClose(buildCloseValidationInput(report, ctx, undefined, { confirmEmptyClose: true })).ok).toBe(
      false,
    )
  })
})
