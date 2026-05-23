/**
 * Proyección pura: `ActaDocumentV1` + intent → `CalendarSyncCommandBundle`.
 * Sin GAS, Sheets, React, retries ni networking.
 */

import type { ActaDocumentV1 } from '../contracts/actaDocument'
import type {
  CalendarEncounterRowKey,
  CalendarRowProjection,
  CalendarSyncCommandBundle,
  CalendarSyncKey,
  CalendarSyncStep,
  DocumentWorkflowPatch,
  ProjectCalendarSyncOptions,
  ResultadosClassificationProjection,
} from '../contracts/calendarSync.contract'
import type { CalendarSyncIntent } from '../contracts/encounterWorkflow.contract'
import { buildLastReopenAudit } from '../utils/encounterWorkflow'

function buildSyncKey(doc: ActaDocumentV1, intent: CalendarSyncIntent): CalendarSyncKey {
  return {
    category: doc.match.category,
    phase: doc.match.phase,
    matchId: doc.match.matchId,
    documentVersion: doc.metadata.documentVersion,
    intent,
  }
}

function buildRowKey(doc: ActaDocumentV1): CalendarEncounterRowKey {
  const enc = doc.match.encounter
  return {
    grupo: enc.grupo,
    equipoLocal: enc.equipoLocal,
    equipoVisitante: enc.equipoVisitante,
    referenciaEncuentro: doc.match.referenciaEncuentro,
  }
}

function step(type: CalendarSyncStep['type'], description: string): CalendarSyncStep {
  return { type, description }
}

function resolveClassificationForClose(
  doc: ActaDocumentV1,
): ResultadosClassificationProjection {
  const official = doc.classification.official
  if (official) {
    return { local: official.local, visitante: official.visitante }
  }
  return {
    local: doc.classification.local,
    visitante: doc.classification.visitante,
  }
}

function buildCloseBundle(
  doc: ActaDocumentV1,
  rowKey: CalendarEncounterRowKey,
): CalendarSyncCommandBundle {
  const syncKey = buildSyncKey(doc, 'close')
  const score = doc.scoring.score
  const row: CalendarRowProjection = {
    resultadoLocal: score.local,
    resultadoVisitante: score.visitante,
    estadoPartido: 'acta_cerrada',
    estadoAlineacionLocal: 'F',
    estadoAlineacionVisitante: 'F',
    clearPdfColumn: false,
  }
  const steps: CalendarSyncStep[] = [
    step('REVERT_COPA_PLACEHOLDERS', 'Verificar/revertir placeholders COPA previos si F2 COPA'),
    step('WRITE_RESULTADOS_ROWS', 'Escribir filas Resultados_Fase con clasificación oficial'),
    step('UPDATE_CALENDAR_ROW', 'Marcador cols 5-6, estados F/F, estado_partido acta_cerrada'),
    step('RECALC_GLOBAL_CLASSIFICATION', 'Recalcular clasificación global de categoría'),
    step('INVALIDATE_CALENDAR_CACHE', 'Invalidar caché calendario canónico'),
  ]
  return {
    syncKey,
    rowKey,
    steps,
    row,
    resultados: resolveClassificationForClose(doc),
    sourceDocument: doc,
  }
}

function buildReopenActaBundle(
  doc: ActaDocumentV1,
  rowKey: CalendarEncounterRowKey,
  options: ProjectCalendarSyncOptions,
): CalendarSyncCommandBundle {
  const syncKey = buildSyncKey(doc, 'reopen_acta')
  const row: CalendarRowProjection = {
    resultadoLocal: null,
    resultadoVisitante: null,
    estadoPartido: 'acta_abierta',
    estadoAlineacionLocal: 'C',
    estadoAlineacionVisitante: 'C',
    clearPdfColumn: true,
  }
  const steps: CalendarSyncStep[] = [
    step('REVERT_COPA_PLACEHOLDERS', 'Revertir sustituciones COPA antes de limpiar resultados'),
    step('DELETE_RESULTADOS_ROWS', 'Borrar filas Resultados_Fase del encuentro'),
    step('TRASH_PDF', 'Eliminar PDF asociado si existe'),
    step('UPDATE_CALENDAR_ROW', 'Limpiar marcador, C/C, acta_abierta; limpiar col PDF'),
    step('INVALIDATE_CALENDAR_CACHE', 'Invalidar caché calendario'),
  ]
  const documentPatch: DocumentWorkflowPatch | undefined =
    options.reopenedBy != null
      ? {
          actaBinding: 'ACTIVE',
          lastReopen: buildLastReopenAudit({
            mode: 'REOPEN_ACTA',
            at: new Date().toISOString(),
            by: options.reopenedBy,
            fromDocumentVersion: doc.metadata.documentVersion,
            reason: options.reopenReason,
          }),
        }
      : undefined

  return {
    syncKey,
    rowKey,
    steps,
    row,
    documentPatch,
    sourceDocument: doc,
  }
}

function buildReopenAlignmentsBundle(
  doc: ActaDocumentV1,
  rowKey: CalendarEncounterRowKey,
  options: ProjectCalendarSyncOptions,
): CalendarSyncCommandBundle {
  const syncKey = buildSyncKey(doc, 'reopen_alignments')
  const alcance = options.reopenAlcance ?? 'A'
  const { estLocal, estVisit } = alignmentTokensForAlcance(alcance)
  const row: CalendarRowProjection = {
    resultadoLocal: null,
    resultadoVisitante: null,
    estadoPartido: 'alineacion_parcial',
    estadoAlineacionLocal: estLocal,
    estadoAlineacionVisitante: estVisit,
    clearPdfColumn: doc.metadata.status === 'ACTA_CERRADA',
  }
  const steps: CalendarSyncStep[] = [
    step('REVERT_COPA_PLACEHOLDERS', 'Revertir sustituciones COPA (F2) antes de mutar fila'),
    step('DELETE_RESULTADOS_ROWS', 'Borrar filas Resultados_Fase'),
    step('TRASH_PDF', 'Eliminar PDF si acta estaba cerrada'),
    step('UPDATE_CALENDAR_ROW', 'Limpiar marcador; alineacion_parcial; estados E/C por alcance'),
    step('RECALC_GLOBAL_CLASSIFICATION', 'Recalcular clasificación global tras limpiar resultados'),
    step('INVALIDATE_CALENDAR_CACHE', 'Invalidar caché calendario'),
  ]
  const reopenedBy = options.reopenedBy ?? 'calendar-admin'
  const documentPatch: DocumentWorkflowPatch = {
    actaBinding: 'SUPERSEDED',
    lastReopen: buildLastReopenAudit({
      mode: 'REOPEN_ALIGNMENTS',
      at: new Date().toISOString(),
      by: reopenedBy,
      fromDocumentVersion: doc.metadata.documentVersion,
      reason: options.reopenReason,
      alcance,
    }),
  }
  return {
    syncKey,
    rowKey,
    steps,
    row,
    documentPatch,
    sourceDocument: doc,
  }
}

function alignmentTokensForAlcance(alcance: 'L' | 'V' | 'A'): {
  estLocal: string
  estVisit: string
} {
  if (alcance === 'L') return { estLocal: 'E', estVisit: 'C' }
  if (alcance === 'V') return { estLocal: 'C', estVisit: 'E' }
  return { estLocal: 'E', estVisit: 'E' }
}

function buildAlignmentCompleteBundle(
  doc: ActaDocumentV1,
  rowKey: CalendarEncounterRowKey,
): CalendarSyncCommandBundle {
  const syncKey = buildSyncKey(doc, 'alignment_complete')
  const row: CalendarRowProjection = {
    resultadoLocal: null,
    resultadoVisitante: null,
    estadoPartido: 'acta_abierta',
    estadoAlineacionLocal: 'C',
    estadoAlineacionVisitante: 'C',
    clearPdfColumn: false,
  }
  const steps: CalendarSyncStep[] = [
    step('UPDATE_CALENDAR_ROW', 'Ambas alineaciones C-C; estado_partido acta_abierta'),
    step('INVALIDATE_CALENDAR_CACHE', 'Invalidar caché calendario'),
  ]
  return {
    syncKey,
    rowKey,
    steps,
    row,
    sourceDocument: doc,
  }
}

/**
 * Proyecta un bundle de sincronización Calendario desde documento JSON commitido.
 */
export function projectActaDocumentToCalendarSyncBundle(
  document: ActaDocumentV1,
  intent: CalendarSyncIntent,
  options: ProjectCalendarSyncOptions = {},
): CalendarSyncCommandBundle {
  const rowKey = buildRowKey(document)
  switch (intent) {
    case 'close':
      return buildCloseBundle(document, rowKey)
    case 'reopen_acta':
      return buildReopenActaBundle(document, rowKey, options)
    case 'reopen_alignments':
      return buildReopenAlignmentsBundle(document, rowKey, options)
    case 'alignment_complete':
      return buildAlignmentCompleteBundle(document, rowKey)
    default: {
      const _exhaustive: never = intent
      throw new Error(`CalendarSyncIntent no soportado: ${String(_exhaustive)}`)
    }
  }
}
