/**
 * A4.4 — Observación operacional post-hydrate / post-op (logs + consistencia).
 */

import type { DocumentRuntimeEntry } from '../domain/documentRuntimeStore'
import type { MatchReportState } from '../types/matchReportState.types'
import { getDocumentRuntimeEntry } from '../domain/documentRuntimeStore'
import {
  logStagingReconcile,
  logStagingRuntimeHydrate,
  logStagingStale,
  logStagingSuperseded,
  shouldLogStagingRuntime,
} from './stagingRuntimeLogger'

export interface RuntimeDocumentConsistencyReport {
  readonly ok: boolean
  readonly issues: readonly string[]
}

export function observeDocumentRuntimeAfterHydrate(
  entry: DocumentRuntimeEntry,
  meta: { readonly source: 'cache' | 'network'; readonly phase?: string },
): void {
  if (!shouldLogStagingRuntime()) return
  const { document: doc } = entry
  logStagingRuntimeHydrate({
    matchId: entry.matchId,
    source: meta.source,
    phase: meta.phase ?? 'load',
    workspaceVersion: doc.metadata.workspaceVersion,
    actaBinding: doc.metadata.actaBinding,
    actaLifecycle: doc.metadata.actaLifecycle,
    loadSource: doc.metadata.loadSource,
    gate: doc.metadata.alignmentGate,
    reconcileOk: doc.reconcile.ok,
    findingCount: doc.reconcile.findingCodes.length,
  })
  if (doc.superseded.isSuperseded) {
    logStagingSuperseded({
      matchId: entry.matchId,
      actaBinding: doc.metadata.actaBinding,
      findingCodes: doc.reconcile.findingCodes,
    })
  }
  if (doc.stale.isStale) {
    logStagingStale({
      matchId: entry.matchId,
      kinds: doc.stale.kinds,
      findings: doc.stale.findings.map((f) => f.code),
    })
  }
  if (!doc.reconcile.ok) {
    logStagingReconcile({
      matchId: entry.matchId,
      findingCodes: doc.reconcile.findingCodes,
    })
  }
}

export function observeDocumentRuntimeOperation(
  operation: 'save' | 'close' | 'reload' | 'navigation',
  detail: Readonly<Record<string, unknown>>,
): void {
  if (!shouldLogStagingRuntime()) return
  logStagingRuntimeHydrate({ operation, ...detail })
}

export function assertRuntimeDocumentConsistency(
  state: MatchReportState,
  matchId?: string,
): RuntimeDocumentConsistencyReport {
  const issues: string[] = []
  const id = matchId ?? state.context?.encuentroId
  const entry = id ? getDocumentRuntimeEntry(id) : null
  const doc = state.document

  if (!doc && !entry) {
    return { ok: true, issues: [] }
  }
  if (!doc && entry) {
    issues.push('state.document ausente pero cache presente')
  }
  if (doc && !entry) {
    issues.push('state.document presente pero cache ausente')
  }
  if (doc && entry && doc.matchId !== entry.document.matchId) {
    issues.push('matchId divergente entre state.document y cache')
  }
  if (doc && entry && doc.metadata.workspaceVersion !== entry.document.metadata.workspaceVersion) {
    issues.push('workspaceVersion divergente entre state y cache')
  }
  if (doc && entry && doc.metadata.actaBinding !== entry.document.metadata.actaBinding) {
    issues.push('actaBinding divergente entre state y cache')
  }
  if (doc && entry) {
    const a = doc.reconcile.findingCodes.join(',')
    const b = entry.document.reconcile.findingCodes.join(',')
    if (a !== b) issues.push('reconcile.findingCodes divergente entre state y cache')
  }
  return { ok: issues.length === 0, issues }
}
