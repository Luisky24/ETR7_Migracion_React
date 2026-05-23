/**
 * Workflow documental del encuentro (JSON) vs workflow operacional (Calendario).
 * `matchStatus` NO se persiste en JSON — solo en Calendario / MatchContext.
 */

import type { ActaDocumentStatus } from './actaDocument/actaLifecycle.contract'
import type { MatchStatus } from './matchReport.contract'

/** Vinculación del documento JSON con el ciclo operativo del encuentro. */
export type ActaBinding = 'ACTIVE' | 'SUPERSEDED'

export type ReopenMode = 'REOPEN_ACTA' | 'REOPEN_ALIGNMENTS'

export type ReopenAlcance = 'L' | 'V' | 'A'

export interface EncounterWorkflowLastReopen {
  readonly mode: ReopenMode
  readonly at: string
  readonly by: string
  readonly reason?: string
  readonly alcance?: ReopenAlcance
  readonly fromDocumentVersion: number
}

/** Persistido en `ActaDocumentMetadata.encounterWorkflow` — sin `matchStatus`. */
export interface EncounterWorkflow {
  readonly actaBinding: ActaBinding
  readonly lastReopen?: EncounterWorkflowLastReopen
}

/**
 * Estado compuesto para reglas UI/sync (runtime).
 * `calendarMatchStatus` proviene de Calendario, no del JSON.
 */
export interface CompositeEncounterState {
  readonly documentStatus: ActaDocumentStatus
  readonly actaBinding: ActaBinding
  readonly calendarMatchStatus: MatchStatus
}

/** Intents oficiales de sincronización Calendario ← Acta JSON. */
export type CalendarSyncIntent =
  | 'close'
  | 'reopen_acta'
  | 'reopen_alignments'
  | 'alignment_complete'
