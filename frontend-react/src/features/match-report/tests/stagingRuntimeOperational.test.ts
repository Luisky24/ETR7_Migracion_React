import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { EncounterWorkspaceLoadResult } from '../contracts/encounterWorkspaceLoad.contract'
import { clearDocumentRuntimeStore, commitDocumentRuntimeLoad } from '../domain/documentRuntimeStore'
import { emptyMatchReport, minimalEncounterWorkspace } from './fixtures'
import {
  runAllStagingRuntimeScenarios,
  runStagingRuntimeScenarioNavigation,
  scenarioRt_hydrate,
  scenarioRt_reopenSuperseded,
  scenarioRt_superseded,
} from '../tools/stagingRuntimeOperational'
import { assertRuntimeDocumentConsistency } from '../tools/observeDocumentRuntimeStaging'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import { loadReportResponse } from './fixtures'
import { shouldLogStagingRuntime, logStagingRuntime } from '../tools/stagingRuntimeLogger'
import type { EncounterWorkspaceLoadPort } from '../contracts/encounterWorkspaceLoad.contract'

function loadResult(overrides?: Partial<EncounterWorkspaceLoadResult>): EncounterWorkspaceLoadResult {
  const report = emptyMatchReport()
  const workspace = minimalEncounterWorkspace(report.context.encuentroId)
  return {
    source: 'workspace_shell',
    lifecycle: 'NO_EXISTE',
    report,
    workspace,
    workspaceVersion: workspace.metadata.workspaceVersion,
    ...overrides,
  }
}

describe('A4.4 stagingRuntimeOperational', () => {
  beforeEach(() => {
    clearDocumentRuntimeStore()
  })

  it('RT_HYDRATE — projections y lineup views', () => {
    const r = scenarioRt_hydrate(loadResult())
    expect(r.ok).toBe(true)
  })

  it('RT_SUPERSEDED — detecta binding y selectors', () => {
    const r = scenarioRt_superseded(loadResult())
    expect(r.ok).toBe(true)
  })

  it('RT_REOPEN_SUPERSEDED — flujo acta + alignment reopened', () => {
    const r = scenarioRt_reopenSuperseded(loadResult())
    expect(r.ok).toBe(true)
  })

  it('RT_NAVIGATION — cache evita doble load', async () => {
    const lr = loadResult()
    const port: EncounterWorkspaceLoadPort = {
      load: vi.fn(async () => lr),
    }
    const r = await runStagingRuntimeScenarioNavigation({
      context: lr.report.context,
      port,
    })
    expect(r.ok).toBe(true)
  })

  it('runAllStagingRuntimeScenarios — suite completa', () => {
    const { ok, results } = runAllStagingRuntimeScenarios(loadResult())
    expect(results.length).toBeGreaterThanOrEqual(6)
    if (!ok) {
      const failed = results.filter((x) => !x.ok)
      expect(failed, JSON.stringify(failed, null, 2)).toEqual([])
    }
    expect(ok).toBe(true)
  })

  it('assertRuntimeDocumentConsistency — state y cache alineados', () => {
    const lr = loadResult()
    const document = commitDocumentRuntimeLoad(lr)
    const response = loadReportResponse(lr.report, { document })
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT',
      payload: { request: { context: lr.report.context } },
    })
    state = matchReportReducer(state, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response },
    })
    const report = assertRuntimeDocumentConsistency(state, lr.report.context.encuentroId)
    expect(report.ok).toBe(true)
  })
})

describe('stagingRuntimeLogger', () => {
  it('shouldLogStagingRuntime en DEV', () => {
    expect(shouldLogStagingRuntime()).toBe(true)
  })

  it('logStagingRuntime no lanza', () => {
    expect(() => logStagingRuntime('RUNTIME', 'test', { ok: true })).not.toThrow()
  })
})
