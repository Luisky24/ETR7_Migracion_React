/**
 * A4.4 — Escenarios operacionales runtime (validación federativa; ejecutable en tests y consola staging).
 * Sin I/O GAS: opera sobre documentRuntimeStore + fixtures. En WebApp real, complementar checklist manual.
 */

import type { EncounterWorkspaceLoadResult } from '../contracts/encounterWorkspaceLoad.contract'
import {
  clearDocumentRuntimeStore,
  commitDocumentRuntimeLoad,
  getDocumentRuntimeEntry,
} from '../domain/documentRuntimeStore'
import { loadDocumentRuntime } from '../services/documentRuntimeLoad.service'
import { buildRuntimeReconcileResultFromDocument } from '../domain/reconcileResultFromDocument'
import { assertRuntimeDocumentConsistency } from './observeDocumentRuntimeStaging'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import type { MatchReportState } from '../types/matchReportState.types'
import type { EncounterWorkspaceLoadPort } from '../contracts/encounterWorkspaceLoad.contract'
import {
  selectIsSuperseded,
  selectRuntimeReconcileFindings,
  selectRuntimeStaleState,
} from '../selectors/matchReportDocumentSelectors'
import {
  selectLineupIsSuperseded,
  selectLineupStaleState,
  selectLineupTeamViews,
} from '../selectors/lineupDocumentSelectors'
import { logStagingRuntime } from './stagingRuntimeLogger'

export type StagingRuntimeScenarioCode =
  | 'RT_NAVIGATION'
  | 'RT_HYDRATE'
  | 'RT_SUPERSEDED'
  | 'RT_STALE'
  | 'RT_CONCURRENT'
  | 'RT_DIAGNOSTICS'
  | 'RT_REOPEN_SUPERSEDED'
  | 'RT_CONSISTENCY'

export interface StagingRuntimeScenarioStep {
  readonly step: string
  readonly ok: boolean
  readonly details?: Readonly<Record<string, unknown>>
}

export interface StagingRuntimeScenarioResult {
  readonly code: StagingRuntimeScenarioCode
  readonly ok: boolean
  readonly steps: readonly StagingRuntimeScenarioStep[]
}

function step(step: string, ok: boolean, details?: Record<string, unknown>): StagingRuntimeScenarioStep {
  return { step, ok, details }
}

function result(
  code: StagingRuntimeScenarioCode,
  steps: StagingRuntimeScenarioStep[],
): StagingRuntimeScenarioResult {
  return { code, ok: steps.every((s) => s.ok), steps }
}

export function scenarioRt_hydrate(loadResult: EncounterWorkspaceLoadResult): StagingRuntimeScenarioResult {
  const steps: StagingRuntimeScenarioStep[] = []
  commitDocumentRuntimeLoad(loadResult)
  logStagingRuntime('RUNTIME', 'scenario.RT_HYDRATE.start', { matchId: loadResult.workspace.identity.matchId })
  const doc = getDocumentRuntimeEntry(loadResult.workspace.identity.matchId)!.document
  const entry = getDocumentRuntimeEntry(doc.matchId)
  steps.push(step('cache entry', Boolean(entry)))
  steps.push(step('projections local', entry?.document.projections.local.side === 'local'))
  steps.push(step('projections visitante', entry?.document.projections.visitante.side === 'visitante'))
  steps.push(
    step(
      'lineup views',
      Boolean(selectLineupTeamViews(doc.matchId)?.local.teamName),
    ),
  )
  return result('RT_HYDRATE', steps)
}

export function scenarioRt_superseded(loadResult: EncounterWorkspaceLoadResult): StagingRuntimeScenarioResult {
  const steps: StagingRuntimeScenarioStep[] = []
  const ws = {
    ...loadResult.workspace,
    workflow: { actaBinding: 'SUPERSEDED' as const },
  }
  const doc = commitDocumentRuntimeLoad({ ...loadResult, workspace: ws })
  steps.push(step('document superseded', doc.superseded.isSuperseded))
  steps.push(step('lineup superseded selector', selectLineupIsSuperseded(doc.matchId)))
  steps.push(
    step(
      'finding WORKSPACE_SUPERSEDED',
      doc.reconcile.findingCodes.includes('WORKSPACE_SUPERSEDED'),
    ),
  )
  return result('RT_SUPERSEDED', steps)
}

function snapshotWithPlayer(playerId: string, dorsal: number, titular: boolean) {
  return {
    players: [{ playerId, displayName: 'J', dorsal }],
    selection: {
      starters: titular ? [playerId] : [],
      bench: titular ? [] : [playerId],
      captain: playerId,
    },
  }
}

export function scenarioRt_stale(loadResult: EncounterWorkspaceLoadResult): StagingRuntimeScenarioResult {
  const steps: StagingRuntimeScenarioStep[] = []
  const local = loadResult.workspace.alignments.local
  const ref = {
    storageKey: 'M::ref::local',
    documentVersion: 2,
    closeRevision: 1,
    lifecycle: 'CLOSED' as const,
    closedAt: '2026-01-01T00:00:00.000Z',
    closedBy: 'test',
    snapshot: snapshotWithPlayer('p1', 9, true),
  }
  const drifted = {
    ...loadResult.workspace,
    alignments: {
      ...loadResult.workspace.alignments,
      local: {
        ...local,
        estado: 'C' as const,
        version: ref.documentVersion,
        alignmentRef: ref,
        players: [
          { playerId: 'p1', jugador: 'J', dorsal: 99, titular: true, suplente: false, capitan: true },
        ],
      },
    },
  }
  const doc = commitDocumentRuntimeLoad({ ...loadResult, workspace: drifted })
  steps.push(step('stale flag', doc.stale.isStale))
  steps.push(step('lineup stale selector', Boolean(selectLineupStaleState(doc.matchId)?.isStale)))
  return result('RT_STALE', steps)
}

export function scenarioRt_concurrent(state: MatchReportState): StagingRuntimeScenarioResult {
  const steps: StagingRuntimeScenarioStep[] = []
  const withConflict: MatchReportState = {
    ...state,
    operationError: {
      code: 'DOCUMENT_VERSION_CONFLICT',
      userMessage: 'Conflicto de versión',
      severity: 'recoverable',
      technicalMessage: 'stale',
    },
    recovery: { shouldReload: true, canRetry: false, canReload: true },
  }
  const stale = selectRuntimeStaleState(withConflict)
  steps.push(step('operation stale', stale?.isStale === true))
  steps.push(step('shouldReload', withConflict.recovery?.shouldReload === true))
  return result('RT_CONCURRENT', steps)
}

export function scenarioRt_diagnostics(loadResult: EncounterWorkspaceLoadResult): StagingRuntimeScenarioResult {
  const steps: StagingRuntimeScenarioStep[] = []
  clearDocumentRuntimeStore()
  const doc = commitDocumentRuntimeLoad(loadResult)
  const entry = getDocumentRuntimeEntry(doc.matchId)!
  const reconcile = buildRuntimeReconcileResultFromDocument({
    document: entry.document,
    workspace: entry.workspace,
  })
  steps.push(step('reconcile ok matches document', reconcile.ok === doc.reconcile.ok))
  steps.push(
    step(
      'finding codes stable',
      reconcile.findings.map((f) => f.code).join() === doc.stale.findings.map((f) => f.code).join() ||
        doc.reconcile.ok,
    ),
  )
  steps.push(step('staleGraph matchId', reconcile.staleGraph.matchId === doc.matchId))
  return result('RT_DIAGNOSTICS', steps)
}

export function scenarioRt_reopenSuperseded(
  loadResult: EncounterWorkspaceLoadResult,
): StagingRuntimeScenarioResult {
  const steps: StagingRuntimeScenarioStep[] = []
  const reopenedRef = {
    storageKey: 'M::ref::local',
    documentVersion: 2,
    closeRevision: 1,
    lifecycle: 'REOPENED' as const,
    closedAt: '2026-01-01T00:00:00.000Z',
    closedBy: 'test',
    snapshot: snapshotWithPlayer('p1', 9, true),
  }
  const ws = {
    ...loadResult.workspace,
    workflow: { actaBinding: 'SUPERSEDED' as const },
    alignments: {
      ...loadResult.workspace.alignments,
      local: {
        ...loadResult.workspace.alignments.local,
        estado: 'C' as const,
        alignmentRef: reopenedRef,
      },
    },
  }
  const doc = commitDocumentRuntimeLoad({ ...loadResult, workspace: ws })
  steps.push(step('workspace SUPERSEDED', doc.metadata.actaBinding === 'SUPERSEDED'))
  steps.push(step('reopened ref lifecycle', doc.projections.local.lifecycle === 'REOPENED'))
  steps.push(step('superseded UX flag', doc.superseded.isSuperseded))
  steps.push(
    step(
      'lifecycle invalid or superseded finding',
      doc.reconcile.findingCodes.some(
        (c) => c === 'WORKSPACE_SUPERSEDED' || c === 'WORKSPACE_ALIGNMENT_LIFECYCLE_INVALID',
      ),
    ),
  )
  return result('RT_REOPEN_SUPERSEDED', steps)
}

export function scenarioRt_consistency(loadResult: EncounterWorkspaceLoadResult): StagingRuntimeScenarioResult {
  const steps: StagingRuntimeScenarioStep[] = []
  const responseDocument = commitDocumentRuntimeLoad(loadResult)
  let state = matchReportReducer(matchReportInitialState, {
    type: 'LOAD_REPORT',
    payload: { request: { context: loadResult.report.context } },
  })
  state = matchReportReducer(state, {
    type: 'LOAD_REPORT_SUCCESS',
    payload: {
      response: {
        report: loadResult.report,
        cerrada: loadResult.report.cerrada,
        fromActaSnapshot: loadResult.report.fromActaSnapshot,
        document: responseDocument,
        workspaceVersion: responseDocument.metadata.workspaceVersion,
        actaBinding: responseDocument.metadata.actaBinding,
      },
    },
  })
  const report = assertRuntimeDocumentConsistency(state, loadResult.report.context.encuentroId)
  steps.push(step('state/cache consistency', report.ok, { issues: report.issues }))
  steps.push(
    step(
      'selectors match document',
      selectRuntimeReconcileFindings(state).join() === responseDocument.reconcile.findingCodes.join(),
    ),
  )
  steps.push(step('superseded selector', selectIsSuperseded(state) === responseDocument.superseded.isSuperseded))
  return result('RT_CONSISTENCY', steps)
}

export async function runStagingRuntimeScenarioNavigation(input: {
  readonly context: EncounterWorkspaceLoadResult['report']['context']
  readonly port: EncounterWorkspaceLoadPort
}): Promise<StagingRuntimeScenarioResult> {
  const steps: StagingRuntimeScenarioStep[] = []
  clearDocumentRuntimeStore()
  let calls = 0
  const wrapped: EncounterWorkspaceLoadPort = {
    load: async (req) => {
      calls += 1
      return input.port.load(req)
    },
  }
  const first = await loadDocumentRuntime(input.context, { workspaceLoadPort: wrapped })
  const second = await loadDocumentRuntime(input.context, { workspaceLoadPort: wrapped })
  steps.push(step('single network load', calls === 1))
  steps.push(step('cache reuse', first.document === second.document))
  return result('RT_NAVIGATION', steps)
}

export function runAllStagingRuntimeScenarios(loadResult: EncounterWorkspaceLoadResult): {
  readonly results: readonly StagingRuntimeScenarioResult[]
  readonly ok: boolean
} {
  const run = (fn: () => StagingRuntimeScenarioResult) => {
    clearDocumentRuntimeStore()
    return fn()
  }
  const results = [
    run(() => scenarioRt_hydrate(loadResult)),
    run(() => scenarioRt_superseded(loadResult)),
    run(() => scenarioRt_stale(loadResult)),
    run(() => scenarioRt_diagnostics(loadResult)),
    run(() => scenarioRt_reopenSuperseded(loadResult)),
    run(() => scenarioRt_consistency(loadResult)),
    scenarioRt_concurrent(
      matchReportReducer(matchReportInitialState, {
        type: 'LOAD_REPORT_SUCCESS',
        payload: {
          response: {
            report: loadResult.report,
            cerrada: loadResult.report.cerrada,
            fromActaSnapshot: loadResult.report.fromActaSnapshot,
            document: commitDocumentRuntimeLoad(loadResult),
          },
        },
      }),
    ),
  ]
  return { results, ok: results.every((r) => r.ok) }
}
