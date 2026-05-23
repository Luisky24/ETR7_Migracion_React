import type { ActaDocumentV1, ActaLifecycleState } from './actaDocument'
import type { MatchContext, MatchReport } from './matchReport.contract'
import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'

export type EncounterWorkspaceLoadSource =
  | 'workspace_acta'
  | 'workspace_alignments'
  | 'workspace_shell'

export interface EncounterWorkspaceLoadRequest {
  readonly context: MatchContext
}

export interface EncounterWorkspaceLoadResult {
  readonly source: EncounterWorkspaceLoadSource
  readonly report: MatchReport
  readonly workspace: EncounterWorkspaceDocumentV1
  readonly lifecycle: ActaLifecycleState
  /** Proyección acta cuando `source === workspace_acta` (sync / calendar). */
  readonly document?: ActaDocumentV1
  readonly workspaceVersion: number
}

export interface EncounterWorkspaceLoadPort {
  load(request: EncounterWorkspaceLoadRequest): Promise<EncounterWorkspaceLoadResult>
}

/** @deprecated Usar EncounterWorkspaceLoadPort — alias de transición. */
export type ActaBootstrapSource = EncounterWorkspaceLoadSource
/** @deprecated Usar EncounterWorkspaceLoadRequest */
export type ActaBootstrapRequest = EncounterWorkspaceLoadRequest
/** @deprecated Usar EncounterWorkspaceLoadResult */
export type ActaBootstrapResult = EncounterWorkspaceLoadResult
/** @deprecated Usar EncounterWorkspaceLoadPort */
export type ActaBootstrapPort = EncounterWorkspaceLoadPort
