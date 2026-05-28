import { getRuntimeEnvironmentSnapshot } from '@/app/runtimeEnvironment'
import { getRuntimeProfile, isStagingGasRuntime } from '@/app/runtimeProfile'
import type { MatchContext } from '@/features/match-report/contracts'
import type { MatchReportState } from '@/features/match-report/types/matchReportState.types'
import {
  getDocumentRuntimeEntry,
  type DocumentRuntimeEntry,
} from '@/features/match-report/domain/documentRuntimeStore'
import { buildRuntimeReconcileResultFromDocument } from '@/features/match-report/domain/reconcileResultFromDocument'
import {
  selectActaBinding,
  selectDocumentRuntime,
  selectRuntimeStaleState,
  selectWorkspaceMetadata,
  selectWorkspaceVersion,
} from '@/features/match-report/selectors/matchReportDocumentSelectors'
import {
  buildAlignmentRefsDump,
  buildStaleStateDump,
  type RuntimeActaLifecycleDump,
  type RuntimeAlignmentRefsDump,
  type RuntimeReconcileResult,
  type RuntimeStaleStateDump,
} from './runtimeReconcileDiagnostics'

export function isRuntimeDocDiagnosticsEnabled(): boolean {
  if (import.meta.env.DEV) return true
  if (isStagingGasRuntime()) return true
  return false
}

function log(event: string, data?: Record<string, unknown>): void {
  if (!isRuntimeDocDiagnosticsEnabled()) return
  // eslint-disable-next-line no-console
  console.info(event, data ?? {})
}

function logFinding(finding: { code: string; side?: string; message: string }): void {
  log('[RUNTIME-FINDING]', { code: finding.code, side: finding.side, message: finding.message })
}

export interface RuntimeDocDiagnosticsHelp {
  readonly summary: string
  readonly commands: ReadonlyArray<{ readonly fn: string; readonly description: string }>
}

export interface RuntimeDocDiagnosticsApi {
  readonly env: () => unknown
  readonly help: () => RuntimeDocDiagnosticsHelp
  readonly dumpWorkspaceState: (matchId?: string) => Promise<unknown>
  readonly dumpActaLifecycle: (matchId?: string) => Promise<RuntimeActaLifecycleDump>
  readonly dumpAlignmentRefs: (matchId?: string) => Promise<RuntimeAlignmentRefsDump>
  readonly dumpStaleState: (matchId?: string) => Promise<RuntimeStaleStateDump>
  readonly runReconcile: (matchId?: string) => Promise<RuntimeReconcileResult>
}

function requireContextForMatch(state: MatchReportState, matchId?: string): MatchContext {
  if (!state.context) throw new Error('No hay MatchContext cargado en runtime.')
  if (matchId && state.context.encuentroId !== matchId) {
    throw new Error('Para inspeccionar otro matchId, navegue al encuentro y reintente.')
  }
  return state.context
}

function runtimeMetaFromState(state: MatchReportState) {
  return {
    actaBinding: selectActaBinding(state),
    workspaceVersion: selectWorkspaceVersion(state),
    recovery: state.recovery,
    operationError: state.operationError ? { code: state.operationError.code } : null,
  }
}

function resolveDocumentRuntimeEntry(
  state: MatchReportState,
  matchId?: string,
): DocumentRuntimeEntry {
  const ctx = state.context
  const targetId = matchId ?? ctx?.encuentroId
  const cached = targetId ? getDocumentRuntimeEntry(targetId) : null
  if (cached) return cached

  const doc = selectDocumentRuntime(state)
  if (doc && targetId && doc.matchId === targetId) {
    const fromCache = getDocumentRuntimeEntry(doc.matchId)
    if (fromCache) return fromCache
  }

  throw new Error(
    'Cache documental vacía. Cargue el encuentro (MatchReport o Lineups) antes de diagnosticar.',
  )
}

const DIAGNOSTICS_HELP: RuntimeDocDiagnosticsHelp = {
  summary:
    'Consola de soporte ETR7 (staging/DEV). Abra un encuentro en MatchReport o Lineups antes de inspeccionar.',
  commands: [
    { fn: 'help()', description: 'Muestra esta ayuda' },
    { fn: 'env()', description: 'Perfil runtime y entorno' },
    { fn: 'dumpWorkspaceState()', description: 'Workspace + proyecciones + findings' },
    { fn: 'dumpActaLifecycle()', description: 'Acta, operación y reconcile' },
    { fn: 'dumpAlignmentRefs()', description: 'Refs de alineación CLOSED' },
    { fn: 'dumpStaleState()', description: 'Grafo stale y recovery' },
    { fn: 'runReconcile()', description: 'Reconcile ref-only (sin mutar Drive)' },
  ],
}

export function createRuntimeDocDiagnosticsApi(getState: () => MatchReportState): RuntimeDocDiagnosticsApi {
  return {
    help: () => {
      log('[RUNTIME-DOC] help', { commands: DIAGNOSTICS_HELP.commands.map((c) => c.fn) })
      return DIAGNOSTICS_HELP
    },

    env: () => {
      const snapshot = getRuntimeEnvironmentSnapshot()
      const profile = getRuntimeProfile()
      return {
        ...snapshot,
        profile,
      }
    },

    dumpWorkspaceState: async (matchId?: string) => {
      const state = getState()
      requireContextForMatch(state, matchId)
      const entry = resolveDocumentRuntimeEntry(state, matchId)
      const meta = selectWorkspaceMetadata(state)
      const out = {
        matchId: entry.matchId,
        workspaceVersion: entry.document.metadata.workspaceVersion,
        actaBinding: entry.document.metadata.actaBinding,
        gate: entry.document.metadata.alignmentGate,
        alignments: entry.document.projections,
        findings: entry.document.reconcile.findingCodes,
        staleGraph: entry.document.stale.staleGraph,
        loadSource: entry.document.metadata.loadSource,
        stateMetadata: meta,
      }
      log('[RUNTIME-DOC] dumpWorkspaceState.ok', out as Record<string, unknown>)
      return out
    },

    dumpActaLifecycle: async (matchId?: string) => {
      const state = getState()
      requireContextForMatch(state, matchId)
      const entry = resolveDocumentRuntimeEntry(state, matchId)
      const reconcile = buildRuntimeReconcileResultFromDocument({
        document: entry.document,
        workspace: entry.workspace,
        runtimeMeta: runtimeMetaFromState(state),
      })
      const out: RuntimeActaLifecycleDump = {
        matchId: entry.matchId,
        actaBinding: selectActaBinding(state),
        workspaceVersion: selectWorkspaceVersion(state),
        operation: state.operation,
        recovery: state.recovery,
        operationError: state.operationError
          ? { code: state.operationError.code, userMessage: state.operationError.userMessage }
          : null,
        report: state.report
          ? {
              cerrada: state.report.cerrada,
              editability: state.report.editability,
              fromActaSnapshot: state.report.fromActaSnapshot,
              matchStatus: state.report.context.matchStatus,
            }
          : null,
        reconcile: {
          ok: reconcile.ok,
          findingCodes: reconcile.findings.map((f) => f.code),
        },
        lifecycle: reconcile.lifecycle,
      }
      log('[RUNTIME-DOC] dumpActaLifecycle', { ...out })
      return out
    },

    dumpAlignmentRefs: async (matchId?: string) => {
      const state = getState()
      requireContextForMatch(state, matchId)
      const entry = resolveDocumentRuntimeEntry(state, matchId)
      const out = buildAlignmentRefsDump(entry.workspace, runtimeMetaFromState(state))
      for (const f of out.findings) logFinding(f)
      log('[RUNTIME-DOC] dumpAlignmentRefs', {
        matchId: out.matchId,
        findings: out.findings.map((f) => f.code),
      })
      return out
    },

    dumpStaleState: async (matchId?: string) => {
      const state = getState()
      requireContextForMatch(state, matchId)
      const entry = resolveDocumentRuntimeEntry(state, matchId)
      const stale = selectRuntimeStaleState(state) ?? entry.document.stale
      const out: RuntimeStaleStateDump = {
        matchId: entry.matchId,
        actaBinding: entry.document.metadata.actaBinding,
        workspaceVersion: entry.document.metadata.workspaceVersion,
        recovery: state.recovery,
        operationError: state.operationError ? { code: state.operationError.code } : null,
        staleGraph: stale.staleGraph,
        findings: stale.findings,
      }
      for (const f of out.findings) log('[RUNTIME-STALE]', { code: f.code, side: f.side })
      log('[RUNTIME-STALE] dumpStaleState', {
        matchId: out.matchId,
        staleCandidates: out.staleGraph?.staleCandidates,
      })
      return out
    },

    runReconcile: async (matchId?: string) => {
      const state = getState()
      requireContextForMatch(state, matchId)
      const entry = resolveDocumentRuntimeEntry(state, matchId)
      const result = buildRuntimeReconcileResultFromDocument({
        document: entry.document,
        workspace: entry.workspace,
        runtimeMeta: runtimeMetaFromState(state),
      })
      log('[RUNTIME-RECONCILE] runReconcile', {
        matchId: result.matchId,
        ok: result.ok,
        findings: result.findings.map((f) => f.code),
        source: 'documentRuntimeStore',
      })
      for (const f of result.findings) logFinding(f)
      return result
    },
  }
}

export function installRuntimeDocDiagnostics(getState: () => MatchReportState): void {
  if (!isRuntimeDocDiagnosticsEnabled()) return
  const api = createRuntimeDocDiagnosticsApi(getState)
  ;(window as unknown as { __ETR7_DOC__?: RuntimeDocDiagnosticsApi }).__ETR7_DOC__ = api
  log('[RUNTIME-DOC] installed', { profile: getRuntimeProfile() })
}

export function uninstallRuntimeDocDiagnostics(): void {
  ;(window as unknown as { __ETR7_DOC__?: unknown }).__ETR7_DOC__ = undefined
}
