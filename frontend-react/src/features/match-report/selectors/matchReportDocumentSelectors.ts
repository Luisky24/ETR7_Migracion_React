import type { MatchReportState } from '../types/matchReportState.types'
import type {
  AlignmentSnapshotProjection,
  MatchReportDocumentMetadata,
  MatchReportDocumentRuntimeState,
  RuntimeStaleState,
  RuntimeSupersededState,
} from '../types/matchReportDocumentRuntime.types'
import type { RuntimeReconcileFinding } from '../tools/runtimeReconcileDiagnostics.contract'

export function selectDocumentRuntime(
  state: MatchReportState,
): MatchReportDocumentRuntimeState | null {
  return state.document
}

export function selectWorkspaceMetadata(state: MatchReportState): MatchReportDocumentMetadata | null {
  return state.document?.metadata ?? null
}

export function selectWorkspaceVersion(state: MatchReportState): number | null {
  return state.document?.metadata.workspaceVersion ?? null
}

export function selectActaBinding(state: MatchReportState): 'ACTIVE' | 'SUPERSEDED' | null {
  return state.document?.metadata.actaBinding ?? null
}

export function selectRuntimeStaleState(state: MatchReportState): RuntimeStaleState | null {
  const doc = state.document
  if (!doc) return null
  const operationStale =
    state.operationError?.code === 'DOCUMENT_VERSION_CONFLICT' ||
    state.recovery?.shouldReload === true
  if (!operationStale) return doc.stale
  return {
    ...doc.stale,
    isStale: true,
    kinds: doc.stale.kinds.includes('ALIGNMENT_DOCUMENT_VERSION_MISMATCH')
      ? doc.stale.kinds
      : ([...doc.stale.kinds, 'ALIGNMENT_DOCUMENT_VERSION_MISMATCH'] as readonly RuntimeReconcileFinding[]),
  }
}

export function selectSupersededState(state: MatchReportState): RuntimeSupersededState {
  const doc = state.document
  if (!doc) {
    return { isSuperseded: false, actaBinding: 'ACTIVE' }
  }
  return doc.superseded
}

export function selectIsSuperseded(state: MatchReportState): boolean {
  return selectSupersededState(state).isSuperseded
}

export function selectAlignmentSnapshots(state: MatchReportState): {
  readonly local: AlignmentSnapshotProjection | null
  readonly visitante: AlignmentSnapshotProjection | null
} {
  const doc = state.document
  if (!doc) return { local: null, visitante: null }
  return {
    local: doc.projections.local,
    visitante: doc.projections.visitante,
  }
}

export function selectRuntimeReconcileFindings(
  state: MatchReportState,
): readonly RuntimeReconcileFinding[] {
  return state.document?.reconcile.findingCodes ?? []
}

export function selectRuntimeReconcileOk(state: MatchReportState): boolean {
  return state.document?.reconcile.ok ?? true
}

export function selectShowStaleBanner(state: MatchReportState): boolean {
  return selectRuntimeStaleState(state)?.isStale === true
}

export function selectShowSupersededBanner(state: MatchReportState): boolean {
  return selectIsSuperseded(state)
}

export function selectShowRecoveryBanner(state: MatchReportState): boolean {
  return Boolean(state.recovery?.shouldReload || state.operationError)
}

/** A5: bloqueo de edición por estado documental (superseded / stale). */
export function selectIsDocumentallyBlocked(state: MatchReportState): boolean {
  if (selectIsSuperseded(state)) return true
  if (selectRuntimeStaleState(state)?.isStale) return true
  if (state.operationError?.code === 'DOCUMENT_VERSION_CONFLICT') return true
  return false
}

export function selectEffectiveReadOnly(state: MatchReportState, reportReadOnly: boolean): boolean {
  return reportReadOnly || selectIsDocumentallyBlocked(state)
}
