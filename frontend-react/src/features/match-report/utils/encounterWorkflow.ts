/**
 * Helpers puros de workflow documental (sin I/O).
 */

import type { ActaDocumentV1 } from '../contracts/actaDocument'
import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'
import type { ActaDocumentMetadata } from '../contracts/actaDocument/actaMetadata.contract'
import type { ActaDocumentStatus } from '../contracts/actaDocument/actaLifecycle.contract'
import type {
  ActaBinding,
  CompositeEncounterState,
  EncounterWorkflow,
  EncounterWorkflowLastReopen,
  ReopenMode,
} from '../contracts/encounterWorkflow.contract'
import type { MatchStatus } from '../contracts'

export const DEFAULT_ACTA_BINDING: ActaBinding = 'ACTIVE'

export function defaultEncounterWorkflow(): EncounterWorkflow {
  return { actaBinding: DEFAULT_ACTA_BINDING }
}

export function resolveEncounterWorkflow(metadata: ActaDocumentMetadata): EncounterWorkflow {
  return metadata.encounterWorkflow ?? defaultEncounterWorkflow()
}

export function getActaBinding(doc: ActaDocumentV1): ActaBinding {
  return resolveEncounterWorkflow(doc.metadata).actaBinding
}

/** Freeze de contenido acta: solo lifecycle documental cerrado. */
export function isDocumentFrozen(status: ActaDocumentStatus): boolean {
  return status === 'ACTA_CERRADA'
}

export function shouldHydrateFromJsonDocument(doc: ActaDocumentV1): boolean {
  return getActaBinding(doc) === 'ACTIVE'
}

/** Hidratar contenido acta embebida solo con binding ACTIVE. */
export function shouldHydrateActaFromWorkspace(ws: EncounterWorkspaceDocumentV1): boolean {
  return ws.acta != null && ws.workflow.actaBinding === 'ACTIVE'
}

export function buildCompositeEncounterState(
  doc: ActaDocumentV1,
  calendarMatchStatus: MatchStatus,
): CompositeEncounterState {
  return {
    documentStatus: doc.metadata.status,
    actaBinding: getActaBinding(doc),
    calendarMatchStatus,
  }
}

export function isBindingConsistentWithStatus(
  _status: ActaDocumentStatus,
  binding: ActaBinding,
): boolean {
  if (binding === 'SUPERSEDED') return true
  return binding === 'ACTIVE'
}

export function validateCompositeEncounterState(state: CompositeEncounterState): {
  readonly ok: boolean
  readonly message?: string
} {
  if (!isBindingConsistentWithStatus(state.documentStatus, state.actaBinding)) {
    return { ok: false, message: 'actaBinding inconsistente con documentStatus' }
  }
  if (state.actaBinding === 'SUPERSEDED' && state.calendarMatchStatus === 'acta_abierta') {
    return {
      ok: false,
      message: 'SUPERSEDED no compatible con calendarMatchStatus acta_abierta sin reconfirmación',
    }
  }
  return { ok: true }
}

export function buildLastReopenAudit(input: {
  mode: ReopenMode
  at: string
  by: string
  fromDocumentVersion: number
  reason?: string
  alcance?: EncounterWorkflowLastReopen['alcance']
}): EncounterWorkflowLastReopen {
  return {
    mode: input.mode,
    at: input.at,
    by: input.by,
    fromDocumentVersion: input.fromDocumentVersion,
    reason: input.reason,
    alcance: input.alcance,
  }
}

export function mergeEncounterWorkflow(
  current: EncounterWorkflow | undefined,
  patch: Partial<EncounterWorkflow>,
): EncounterWorkflow {
  const base = current ?? defaultEncounterWorkflow()
  return {
    actaBinding: patch.actaBinding ?? base.actaBinding,
    lastReopen: patch.lastReopen ?? base.lastReopen,
  }
}
