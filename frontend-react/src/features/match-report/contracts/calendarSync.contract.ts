/**
 * Contratos de sincronización Calendario ← documento JSON.
 * Transporte GAS futuro implementará `CalendarSyncPort`.
 */

import type { ActaDocumentV1 } from './actaDocument/actaDocument.contract'
import type {
  ActaBinding,
  CalendarSyncIntent,
  EncounterWorkflowLastReopen,
  ReopenAlcance,
} from './encounterWorkflow.contract'
import type { MatchCategory, MatchClassification, MatchPhaseLabel, MatchStatus } from './matchReport.contract'

export type { CalendarSyncIntent } from './encounterWorkflow.contract'

export interface CalendarSyncKey {
  readonly category: MatchCategory
  readonly phase: MatchPhaseLabel
  readonly matchId: string
  readonly documentVersion: number
  readonly intent: CalendarSyncIntent
}

export function buildCalendarSyncKeyString(key: CalendarSyncKey): string {
  return `${key.category}::${key.phase}::${key.matchId}::v${key.documentVersion}::${key.intent}`
}

export interface CalendarEncounterRowKey {
  readonly grupo: string
  readonly equipoLocal: string
  readonly equipoVisitante: string
  readonly referenciaEncuentro?: string
}

export interface CalendarRowProjection {
  readonly resultadoLocal: number | null
  readonly resultadoVisitante: number | null
  readonly estadoPartido: MatchStatus
  readonly estadoAlineacionLocal: string
  readonly estadoAlineacionVisitante: string
  readonly clearPdfColumn: boolean
}

export interface ResultadosClassificationProjection {
  readonly local: MatchClassification
  readonly visitante: MatchClassification
}

export type CalendarSyncStepType =
  | 'UPDATE_CALENDAR_ROW'
  | 'DELETE_RESULTADOS_ROWS'
  | 'WRITE_RESULTADOS_ROWS'
  | 'REVERT_COPA_PLACEHOLDERS'
  | 'RECALC_GLOBAL_CLASSIFICATION'
  | 'TRASH_PDF'
  | 'INVALIDATE_CALENDAR_CACHE'

export interface CalendarSyncStep {
  readonly type: CalendarSyncStepType
  readonly description: string
}

export interface DocumentWorkflowPatch {
  readonly actaBinding: ActaBinding
  readonly lastReopen?: EncounterWorkflowLastReopen
}

/** Bundle puro proyectado desde `ActaDocumentV1` + intent. */
export interface CalendarSyncCommandBundle {
  readonly syncKey: CalendarSyncKey
  readonly rowKey: CalendarEncounterRowKey
  readonly steps: readonly CalendarSyncStep[]
  readonly row: CalendarRowProjection
  readonly resultados?: ResultadosClassificationProjection
  readonly documentPatch?: DocumentWorkflowPatch
  readonly sourceDocument: ActaDocumentV1
}

export type CalendarSyncLedgerStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface CalendarSyncLedgerEntry {
  readonly syncKey: CalendarSyncKey
  readonly syncKeyString: string
  readonly intent: CalendarSyncIntent
  readonly status: CalendarSyncLedgerStatus
  readonly retries: number
  readonly lastError?: string
  readonly createdAt: string
  readonly updatedAt: string
}

export type CalendarSyncBlockReason =
  | 'INVALID_DOCUMENT'
  | 'BINDING_SUPERSEDED'
  | 'LIFECYCLE_VIOLATION'
  | 'MISSING_ROW_KEY'

export interface CalendarSyncScheduleResult {
  readonly scheduled: boolean
  readonly duplicate?: boolean
  readonly blocked?: boolean
  readonly blockReason?: CalendarSyncBlockReason
  readonly syncKeyString?: string
}

export interface CalendarSyncExecuteResult {
  readonly ok: boolean
  readonly syncKeyString: string
  readonly status: CalendarSyncLedgerStatus
  readonly stepsExecuted: number
  readonly message?: string
}

/** Puerto de transporte (mock / GAS futuro). */
export interface CalendarSyncPort {
  execute(bundle: CalendarSyncCommandBundle): Promise<CalendarSyncExecuteResult>
}

export interface ProjectCalendarSyncOptions {
  readonly reopenAlcance?: ReopenAlcance
  readonly reopenedBy?: string
  readonly reopenReason?: string
}
