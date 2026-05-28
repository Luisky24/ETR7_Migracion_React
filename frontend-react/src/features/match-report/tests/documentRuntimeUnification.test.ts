import { describe, expect, it, beforeEach, vi } from 'vitest'
import { workspaceLoadResultToLoadResponse } from '../services/matchReportLoad.service'
import { loadDocumentRuntime } from '../services/documentRuntimeLoad.service'
import { getDocumentRuntimeEntry } from '../domain/documentRuntimeStore'
import { clearDocumentRuntimeStore } from '../domain/documentRuntimeStore'
import { selectLineupTeamViews } from '../selectors/lineupDocumentSelectors'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import { baseContext, emptyMatchReport, loadReportResponse, minimalEncounterWorkspace } from './fixtures'
import type { EncounterWorkspaceLoadPort } from '../contracts/encounterWorkspaceLoad.contract'

describe('A4.3 unified documentary runtime', () => {
  beforeEach(() => {
    clearDocumentRuntimeStore()
  })

  it('MatchReport load and Lineups load share same cache entry', async () => {
    const context = baseContext()
    const report = emptyMatchReport(context)
    const workspace = minimalEncounterWorkspace(context.encuentroId)
    const port: EncounterWorkspaceLoadPort = {
      load: vi.fn(async () => ({
        source: 'workspace_shell' as const,
        lifecycle: 'NO_EXISTE' as const,
        report,
        workspace,
        workspaceVersion: 1,
      })),
    }

    const entry1 = await loadDocumentRuntime(context, { workspaceLoadPort: port })
    const loadResult = entry1.loadResult
    const response = workspaceLoadResultToLoadResponse(loadResult)
    const state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report, { document: response.document }) },
    })

    const entry2 = getDocumentRuntimeEntry(context.encuentroId)
    expect(entry2?.document.matchId).toBe(context.encuentroId)
    expect(state.document?.matchId).toBe(context.encuentroId)
    expect(selectLineupTeamViews(context.encuentroId)?.local.teamName).toBe('LOCAL')
    expect(port.load).toHaveBeenCalledTimes(1)
  })
})
