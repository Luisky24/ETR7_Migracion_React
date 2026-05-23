import type { EncounterWorkflow } from '../encounterWorkflow.contract'
import type { ActaDocumentStatus } from './actaLifecycle.contract'

/** Metadata técnica/documental — separada del dominio rugby. */
export interface ActaDocumentMetadata {
  readonly schemaVersion: 1
  /** Ownership repositorio; el cliente solo envía `expectedDocumentVersion` en saves. */
  readonly documentVersion: number
  readonly status: ActaDocumentStatus
  readonly createdAt: string
  readonly updatedAt: string
  readonly createdBy?: string
  readonly lastSavedBy?: string
  readonly closedAt?: string
  readonly closedBy?: string
  readonly reopenedAt?: string
  readonly reopenedBy?: string
  readonly reopenReason?: string
  /**
   * Workflow documental JSON (sin `matchStatus` — Calendario es source of truth operacional).
   */
  readonly encounterWorkflow?: EncounterWorkflow
}
