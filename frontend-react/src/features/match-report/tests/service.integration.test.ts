import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseContext, emptyMatchReport } from './fixtures'
import { buildMatchPersistenceDto } from '../utils/persistenceDto'
import {
  closeMatchReport,
  getActiveService,
  getMatchReportServiceMode,
  loadMatchReport,
  saveMatchReportDraft,
  setMatchReportServiceMode,
} from '../services/matchReport.service'
import { resetQaRuntimeSimulation } from '../utils/qaRuntimeSimulation'

describe('matchReport.service', () => {
  beforeEach(() => {
    resetQaRuntimeSimulation()
    setMatchReportServiceMode('mock')
  })

  it('defaults to mock mode', () => {
    expect(getMatchReportServiceMode()).toBe('mock')
  })

  it('getActiveService switches implementation when mode changes', () => {
    setMatchReportServiceMode('mock')
    const mockActive = getActiveService()
    setMatchReportServiceMode('gas')
    const gasActive = getActiveService()
    expect(mockActive).not.toBe(gasActive)
    setMatchReportServiceMode('mock')
  })

  it('loads mock report', async () => {
    const res = await loadMatchReport({ context: baseContext() })
    expect(res.report.context.grupo).toBe('A')
    expect(res.report.local.players.length).toBeGreaterThan(0)
  })

  it('saves draft in mock mode', async () => {
    const report = emptyMatchReport()
    const dto = buildMatchPersistenceDto(report, false)
    const res = await saveMatchReportDraft(dto, report)
    expect(res.ok).toBe(true)
  })

  it('closes report in mock mode', async () => {
    const report = emptyMatchReport(baseContext({ matchStatus: 'acta_abierta' }))
    const dto = buildMatchPersistenceDto(report, true)
    const res = await closeMatchReport(dto, report)
    expect(res.ok).toBe(true)
    expect(res.cerrada).toBe(true)
  })

  it('delegates load to gas when mode is gas', async () => {
    vi.resetModules()
    vi.doMock('../services/matchReport.service.gas', () => ({
      gasLoadMatchReport: vi.fn().mockResolvedValue({
        report: emptyMatchReport(),
        cerrada: false,
        fromActaSnapshot: false,
      }),
      gasSaveMatchReportDraft: vi.fn(),
      gasCloseMatchReport: vi.fn(),
    }))
    const { loadMatchReport: loadGas, setMatchReportServiceMode: setMode } = await import(
      '../services/matchReport.service'
    )
    setMode('gas')
    const { gasLoadMatchReport } = await import('../services/matchReport.service.gas')
    await loadGas({ context: baseContext() })
    expect(gasLoadMatchReport).toHaveBeenCalled()
    vi.doUnmock('../services/matchReport.service.gas')
    vi.resetModules()
    setMatchReportServiceMode('mock')
  })
})
