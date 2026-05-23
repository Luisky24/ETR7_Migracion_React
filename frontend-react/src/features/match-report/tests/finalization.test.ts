import { describe, expect, it } from 'vitest'
import {
  finalizeMatchReport,
  isReportEditable,
  lockReport,
} from '../domain/finalization'
import { recalculateMatchReport } from '../domain/scoring'
import { baseContext, emptyMatchReport, playerLine } from './fixtures'

describe('finalization', () => {
  it('lockReport marca cerrada y solo lectura', () => {
    const report = emptyMatchReport()
    const { report: locked } = lockReport(report)
    expect(locked.cerrada).toBe(true)
    expect(locked.editability).toBe('read_only')
    expect(isReportEditable(locked)).toBe(false)
  })

  it('finalizeMatchReport válido cierra acta', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 2 }, { titular: true })],
      },
    })
    const result = finalizeMatchReport({
      report,
      closeValidation: { report, allowScoreOnlyClose: true },
    })
    expect(result.validation.ok).toBe(true)
    expect(result.closure.ok).toBe(true)
    expect(result.closure.cerrada).toBe(true)
    expect(result.report.cerrada).toBe(true)
  })

  it('finalizeMatchReport inválido mantiene abierto', () => {
    const report = emptyMatchReport()
    const result = finalizeMatchReport({
      report,
      closeValidation: { report, allowScoreOnlyClose: false },
    })
    expect(result.validation.ok).toBe(false)
    expect(result.closure.ok).toBe(false)
    expect(result.report.cerrada).toBe(false)
  })

  it('finalize 0-0 sin acciones requiere confirmEmptyClose', () => {
    const report = emptyMatchReport()
    const closeValidation = { report, allowScoreOnlyClose: true as const }

    const withoutConfirm = finalizeMatchReport({ report, closeValidation })
    expect(withoutConfirm.validation.ok).toBe(false)
    expect(withoutConfirm.report.cerrada).toBe(false)

    const withConfirm = finalizeMatchReport({
      report,
      closeValidation: { ...closeValidation, confirmEmptyClose: true },
    })
    expect(withConfirm.validation.ok).toBe(true)
    expect(withConfirm.closure.ok).toBe(true)
    expect(withConfirm.report.cerrada).toBe(true)
  })

  it('finalize con gasOfficial aplica BO F2', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(baseContext({ phase: 'Fase II', referenciaEncuentro: 'REF1' })),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 2 }, { titular: true })],
      },
    })
    const result = finalizeMatchReport({
      report,
      closeValidation: { report, allowScoreOnlyClose: true },
      gasOfficial: { isCopaGroup: true, f2BonusPoints: 1.5 },
    })
    expect(result.closure.ok).toBe(true)
    expect(result.report.local.classification.BO).toBe(1.5)
  })
})
