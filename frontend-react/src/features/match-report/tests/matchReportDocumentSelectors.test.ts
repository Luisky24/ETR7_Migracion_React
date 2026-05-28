import { describe, expect, it } from 'vitest'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import {
  selectAlignmentSnapshots,
  selectIsSuperseded,
  selectRuntimeReconcileFindings,
  selectEffectiveReadOnly,
  selectIsDocumentallyBlocked,
  selectRuntimeStaleState,
  selectWorkspaceMetadata,
} from '../selectors/matchReportDocumentSelectors'
import { emptyMatchReport, loadReportResponse, minimalDocumentRuntime } from './fixtures'

describe('A4.2 matchReportDocumentSelectors', () => {
  it('selectWorkspaceMetadata desde document', () => {
    const report = emptyMatchReport()
    const document = minimalDocumentRuntime(report.context.encuentroId, {
      metadata: { workspaceVersion: 7, actaBinding: 'ACTIVE', actaLifecycle: 'ACTA_EN_CURSO', loadSource: 'workspace_acta', workspacePhase: 'acta_in_progress', alignmentGate: 'both_closed', actaDocumentVersion: 3 },
    })
    const state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report, { document }) },
    })
    expect(selectWorkspaceMetadata(state)?.workspaceVersion).toBe(7)
  })

  it('selectIsSuperseded', () => {
    const report = emptyMatchReport()
    const document = minimalDocumentRuntime(report.context.encuentroId, {
      superseded: { isSuperseded: true, actaBinding: 'SUPERSEDED' },
    })
    const state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report, { document }) },
    })
    expect(selectIsSuperseded(state)).toBe(true)
  })

  it('selectRuntimeReconcileFindings expone findingCodes', () => {
    const report = emptyMatchReport()
    const document = minimalDocumentRuntime(report.context.encuentroId, {
      reconcile: { ok: false, findingCodes: ['WORKSPACE_GATE_MISMATCH'] },
    })
    const state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report, { document }) },
    })
    expect(selectRuntimeReconcileFindings(state)).toContain('WORKSPACE_GATE_MISMATCH')
  })

  it('selectAlignmentSnapshots proyecta lados', () => {
    const report = emptyMatchReport()
    const state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    const snaps = selectAlignmentSnapshots(state)
    expect(snaps.local?.side).toBe('local')
    expect(snaps.visitante?.side).toBe('visitante')
  })

  it('selectRuntimeStaleState marca stale con conflicto de versión', () => {
    const report = emptyMatchReport()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    state = {
      ...state,
      operationError: {
        code: 'DOCUMENT_VERSION_CONFLICT',
        userMessage: 'Conflicto',
        severity: 'recoverable',
      },
      recovery: { shouldReload: true, canRetry: false, canReload: true },
    }
    expect(selectRuntimeStaleState(state)?.isStale).toBe(true)
    expect(selectIsDocumentallyBlocked(state)).toBe(true)
  })

  it('selectEffectiveReadOnly con superseded', () => {
    const report = emptyMatchReport()
    const document = minimalDocumentRuntime(report.context.encuentroId, {
      superseded: { isSuperseded: true, actaBinding: 'SUPERSEDED' },
    })
    const state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report, { document }) },
    })
    expect(selectEffectiveReadOnly(state, false)).toBe(true)
  })
})
