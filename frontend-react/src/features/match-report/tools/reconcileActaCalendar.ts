/**
 * Diagnóstico operacional JSON Acta ↔ Calendario ↔ Resultados (sin mutación ni autorepair).
 */

import type { ActaDocumentV1 } from '../contracts/actaDocument'
import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'
import { validateEncounterWorkspaceDocument } from '@/shared/contracts/validateEncounterWorkspaceDocument'
import { actaDocumentV1FromWorkspace } from '../adapters/workspaceActa.mapper'
import { shouldHydrateActaFromWorkspace } from '../utils/encounterWorkflow'
import type {
  CalendarSyncIntent,
  CalendarSyncLedgerEntry,
  CalendarSyncLedgerStatus,
} from '../contracts/calendarSync.contract'
import { buildCalendarSyncKeyString } from '../contracts/calendarSync.contract'
import type { CompositeEncounterState, ReopenMode } from '../contracts/encounterWorkflow.contract'
import type { MatchClassification, MatchStatus } from '../contracts/matchReport.contract'
import { validateActaDocument } from '../persistence/documentValidators'
import {
  getActaBinding,
  shouldHydrateFromJsonDocument,
  validateCompositeEncounterState,
} from '../utils/encounterWorkflow'

export type ReconcileSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'FATAL'

export type ReconcileCategory =
  | 'lifecycle'
  | 'binding'
  | 'scores'
  | 'classification'
  | 'sync'
  | 'pdf'
  | 'copa'
  | 'document'

export interface ReconcileFinding {
  readonly code: string
  readonly severity: ReconcileSeverity
  readonly category: ReconcileCategory
  readonly message: string
  readonly recommendation?: string
  readonly details?: Readonly<Record<string, unknown>>
}

export type ActaCalendarReconcileStatus = 'OK' | 'WARNING' | 'ERROR' | 'FATAL'

export interface ActaCalendarReconcileReport {
  readonly matchId: string
  readonly documentVersion?: number
  readonly status: ActaCalendarReconcileStatus
  readonly findings: readonly ReconcileFinding[]
  readonly warnings: readonly ReconcileFinding[]
  readonly blockingIssues: readonly ReconcileFinding[]
  readonly inconsistencies: readonly ReconcileFinding[]
  readonly repairRecommendations: readonly string[]
  readonly checkedAt: string
}

/** Fila operacional Calendario (lectura externa, sin I/O aquí). */
export interface CalendarOperationalSnapshot {
  readonly matchStatus: MatchStatus
  readonly resultadoLocal: number | null
  readonly resultadoVisitante: number | null
  readonly estadoAlineacionLocal?: string
  readonly estadoAlineacionVisitante?: string
  readonly pdfPresent?: boolean
  readonly pdfColumnSet?: boolean
}

/** Filas Resultados_Fase del encuentro (lectura externa). */
export interface ResultadosOperationalSnapshot {
  readonly rowsPresent: boolean
  readonly resultadoLocal: number | null
  readonly resultadoVisitante: number | null
  readonly localClassification?: MatchClassification
  readonly visitanteClassification?: MatchClassification
}

export interface CopaOperationalSnapshot {
  readonly placeholdersPending?: boolean
  readonly substitutionsNotReverted?: boolean
}

export interface ActaCalendarReconcileInput {
  readonly matchId: string
  readonly document: ActaDocumentV1 | null
  readonly documentParseError?: string
  readonly calendar: CalendarOperationalSnapshot | null
  readonly resultados: ResultadosOperationalSnapshot | null
  readonly syncLedger: readonly CalendarSyncLedgerEntry[]
  readonly copa?: CopaOperationalSnapshot
  readonly now?: () => string
}

function finding(
  code: string,
  severity: ReconcileSeverity,
  category: ReconcileCategory,
  message: string,
  recommendation?: string,
  details?: Readonly<Record<string, unknown>>,
): ReconcileFinding {
  return { code, severity, category, message, recommendation, details }
}

function scoresEqual(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return a === b
}

function classificationEqual(
  a: MatchClassification | undefined,
  b: MatchClassification | undefined,
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.P === b.P && a.BO === b.BO && a.BD === b.BD && a.Total === b.Total
}

/** Estado Calendario esperado según documento JSON (heurística operacional, sin mutar). */
export function expectedCalendarMatchStatus(doc: ActaDocumentV1): MatchStatus | null {
  const binding = getActaBinding(doc)
  const docStatus = doc.metadata.status
  const lastMode = doc.metadata.encounterWorkflow?.lastReopen?.mode

  if (docStatus === 'ACTA_CERRADA' && binding === 'ACTIVE') {
    return 'acta_cerrada'
  }
  if (docStatus === 'ACTA_EN_CURSO' && binding === 'ACTIVE') {
    return 'acta_abierta'
  }
  if (binding === 'SUPERSEDED' && lastMode === 'REOPEN_ALIGNMENTS') {
    return 'alineacion_parcial'
  }
  if (docStatus === 'ACTA_CERRADA' && binding === 'SUPERSEDED') {
    return 'alineacion_parcial'
  }
  return null
}

export function compareLifecycle(
  doc: ActaDocumentV1,
  calendar: CalendarOperationalSnapshot,
): readonly ReconcileFinding[] {
  const findings: ReconcileFinding[] = []
  const expected = expectedCalendarMatchStatus(doc)
  const docStatus = doc.metadata.status

  if (expected && calendar.matchStatus !== expected) {
    findings.push(
      finding(
        'LIFECYCLE_CALENDAR_MISMATCH',
        'ERROR',
        'lifecycle',
        `JSON ${docStatus} / binding ${getActaBinding(doc)} esperaba Calendario=${expected}, actual=${calendar.matchStatus}`,
        'Ejecutar calendar sync con intent adecuado o revisar reapertura manual en Calendario.',
        { expected, actual: calendar.matchStatus, documentStatus: docStatus },
      ),
    )
  }

  if (docStatus === 'ACTA_CERRADA' && calendar.matchStatus === 'acta_abierta') {
    findings.push(
      finding(
        'JSON_CLOSED_CALENDAR_OPEN',
        'ERROR',
        'lifecycle',
        'JSON ACTA_CERRADA pero Calendario acta_abierta',
        'Revisar sync close fallido o reapertura operacional sin actualizar JSON.',
      ),
    )
  }

  if (docStatus === 'ACTA_EN_CURSO' && calendar.matchStatus === 'acta_cerrada') {
    findings.push(
      finding(
        'JSON_OPEN_CALENDAR_CLOSED',
        'ERROR',
        'lifecycle',
        'JSON ACTA_EN_CURSO pero Calendario acta_cerrada',
        'Verificar cierre operacional pendiente de persistencia JSON o sync revertido.',
      ),
    )
  }

  return findings
}

export function compareWorkflow(
  doc: ActaDocumentV1,
  calendar: CalendarOperationalSnapshot,
): readonly ReconcileFinding[] {
  const findings: ReconcileFinding[] = []
  const composite: CompositeEncounterState = {
    documentStatus: doc.metadata.status,
    actaBinding: getActaBinding(doc),
    calendarMatchStatus: calendar.matchStatus,
  }
  const compositeCheck = validateCompositeEncounterState(composite)
  if (!compositeCheck.ok) {
    findings.push(
      finding(
        'COMPOSITE_STATE_INVALID',
        'ERROR',
        'binding',
        compositeCheck.message ?? 'Estado compuesto inválido',
        'Alinear binding JSON con estado Calendario tras reopen.',
        { composite },
      ),
    )
  }

  if (getActaBinding(doc) === 'SUPERSEDED' && shouldHydrateFromJsonDocument(doc)) {
    findings.push(
      finding(
        'SUPERSEDED_HYDRATE_CONFLICT',
        'ERROR',
        'binding',
        'SUPERSEDED pero bootstrap seguiría hidratando JSON',
        'Corregir actaBinding en metadata JSON (debe ser SUPERSEDED sin hydrate).',
      ),
    )
  }

  const lastReopen = doc.metadata.encounterWorkflow?.lastReopen
  if (lastReopen?.mode === 'REOPEN_ALIGNMENTS' && getActaBinding(doc) !== 'SUPERSEDED') {
    findings.push(
      finding(
        'REOPEN_ALIGNMENTS_BINDING',
        'ERROR',
        'binding',
        'REOPEN_ALIGNMENTS sin actaBinding SUPERSEDED',
        'Actualizar encounterWorkflow.actaBinding a SUPERSEDED en JSON admin.',
        { binding: getActaBinding(doc) },
      ),
    )
  }

  if (lastReopen?.mode === 'REOPEN_ACTA' && getActaBinding(doc) === 'SUPERSEDED') {
    findings.push(
      finding(
        'REOPEN_ACTA_SUPERSEDED',
        'ERROR',
        'binding',
        'REOPEN_ACTA con actaBinding SUPERSEDED',
        'Restablecer actaBinding ACTIVE tras reopen acta.',
      ),
    )
  }

  return findings
}

export function validateBinding(doc: ActaDocumentV1): readonly ReconcileFinding[] {
  const findings: ReconcileFinding[] = []
  const binding = getActaBinding(doc)
  if (binding !== 'ACTIVE' && binding !== 'SUPERSEDED') {
    findings.push(
      finding(
        'INVALID_BINDING_VALUE',
        'FATAL',
        'document',
        `actaBinding inválido: ${String(binding)}`,
        'Reparar metadata.encounterWorkflow manualmente.',
      ),
    )
  }
  return findings
}

export function compareScores(
  doc: ActaDocumentV1,
  calendar: CalendarOperationalSnapshot,
  resultados: ResultadosOperationalSnapshot | null,
): readonly ReconcileFinding[] {
  const findings: ReconcileFinding[] = []
  const jsonLocal = doc.scoring.score.local
  const jsonVisit = doc.scoring.score.visitante
  const expectedStatus = expectedCalendarMatchStatus(doc)
  const openLike =
    expectedStatus === 'acta_abierta' || expectedStatus === 'alineacion_parcial'

  if (openLike) {
    if (calendar.resultadoLocal != null || calendar.resultadoVisitante != null) {
      findings.push(
        finding(
          'MARKER_NOT_CLEARED',
          'ERROR',
          'scores',
          'Calendario conserva marcador tras estado abierto/parcial',
          'Aplicar reopen_acta o reopen_alignments sync; limpiar cols 5-6.',
          {
            calendarLocal: calendar.resultadoLocal,
            calendarVisit: calendar.resultadoVisitante,
          },
        ),
      )
    }
    if (resultados?.rowsPresent) {
      findings.push(
        finding(
          'RESULTADOS_ORPHAN_ROWS',
          'ERROR',
          'scores',
          'Resultados_* conserva filas con acta no cerrada',
          'Borrar filas del encuentro en Resultados y recalcular clasificación.',
        ),
      )
    }
    return findings
  }

  if (expectedStatus === 'acta_cerrada') {
    if (!scoresEqual(jsonLocal, calendar.resultadoLocal)) {
      findings.push(
        finding(
          'SCORE_CALENDAR_MISMATCH',
          'ERROR',
          'scores',
          `Marcador JSON local ${jsonLocal} ≠ Calendario ${String(calendar.resultadoLocal)}`,
          'Re-ejecutar sync close o corregir Calendario manualmente.',
        ),
      )
    }
    if (!scoresEqual(jsonVisit, calendar.resultadoVisitante)) {
      findings.push(
        finding(
          'SCORE_CALENDAR_MISMATCH',
          'ERROR',
          'scores',
          `Marcador JSON visitante ${jsonVisit} ≠ Calendario ${String(calendar.resultadoVisitante)}`,
          'Re-ejecutar sync close o corregir Calendario manualmente.',
        ),
      )
    }
    if (resultados) {
      if (!resultados.rowsPresent) {
        findings.push(
          finding(
            'RESULTADOS_MISSING',
            'ERROR',
            'scores',
            'Acta cerrada en JSON sin filas en Resultados_*',
            'Ejecutar sync close o escribir resultados manualmente.',
          ),
        )
      } else {
        if (!scoresEqual(jsonLocal, resultados.resultadoLocal)) {
          findings.push(
            finding(
              'SCORE_RESULTADOS_MISMATCH',
              'ERROR',
              'scores',
              'Marcador JSON ≠ Resultados_* (local)',
              'Revisar escritura dual LV/VL en Resultados.',
            ),
          )
        }
        if (!scoresEqual(jsonVisit, resultados.resultadoVisitante)) {
          findings.push(
            finding(
              'SCORE_RESULTADOS_MISMATCH',
              'ERROR',
              'scores',
              'Marcador JSON ≠ Resultados_* (visitante)',
              'Revisar escritura dual LV/VL en Resultados.',
            ),
          )
        }
      }
    }
  }

  return findings
}

export function resolveOfficialClassification(
  doc: ActaDocumentV1,
): { readonly local: MatchClassification; readonly visitante: MatchClassification } {
  const official = doc.classification.official
  if (official) {
    return { local: official.local, visitante: official.visitante }
  }
  return { local: doc.classification.local, visitante: doc.classification.visitante }
}

export function compareClassification(
  doc: ActaDocumentV1,
  resultados: ResultadosOperationalSnapshot | null,
): readonly ReconcileFinding[] {
  const findings: ReconcileFinding[] = []
  if (doc.metadata.status !== 'ACTA_CERRADA') {
    return findings
  }

  const official = resolveOfficialClassification(doc)
  if (doc.classification.official) {
    findings.push(
      finding(
        'CLASSIFICATION_OFFICIAL_FROZEN',
        'INFO',
        'classification',
        'Clasificación oficial congelada en JSON (post-close)',
        undefined,
        { appliedAt: doc.classification.official.appliedAt },
      ),
    )
  }

  if (!resultados?.rowsPresent) {
    return findings
  }

  if (
    resultados.localClassification &&
    !classificationEqual(official.local, resultados.localClassification)
  ) {
    findings.push(
      finding(
        'CLASSIFICATION_RESULTADOS_MISMATCH',
        'WARNING',
        'classification',
        'Clasificación Resultados local diverge de JSON oficial',
        'Recalcular clasificación global o re-sync close.',
        { json: official.local, resultados: resultados.localClassification },
      ),
    )
  }
  if (
    resultados.visitanteClassification &&
    !classificationEqual(official.visitante, resultados.visitanteClassification)
  ) {
    findings.push(
      finding(
        'CLASSIFICATION_RESULTADOS_MISMATCH',
        'WARNING',
        'classification',
        'Clasificación Resultados visitante diverge de JSON oficial',
        'Recalcular clasificación global o re-sync close.',
        { json: official.visitante, resultados: resultados.visitanteClassification },
      ),
    )
  }

  return findings
}

export function expectedSyncIntents(doc: ActaDocumentV1): readonly CalendarSyncIntent[] {
  const intents: CalendarSyncIntent[] = []
  const lastMode = doc.metadata.encounterWorkflow?.lastReopen?.mode

  if (doc.metadata.status === 'ACTA_CERRADA' && getActaBinding(doc) === 'ACTIVE') {
    intents.push('close')
  }
  if (lastMode === 'REOPEN_ACTA') {
    intents.push('reopen_acta')
  }
  if (lastMode === 'REOPEN_ALIGNMENTS') {
    intents.push('reopen_alignments')
  }
  return intents
}

export function validateSyncLedger(
  doc: ActaDocumentV1,
  ledger: readonly CalendarSyncLedgerEntry[],
): readonly ReconcileFinding[] {
  const findings: ReconcileFinding[] = []
  const version = doc.metadata.documentVersion

  for (const intent of expectedSyncIntents(doc)) {
    const keyString = buildCalendarSyncKeyString({
      category: doc.match.category,
      phase: doc.match.phase,
      matchId: doc.match.matchId,
      documentVersion: version,
      intent,
    })
    const entry = ledger.find((e) => e.syncKeyString === keyString)
    if (!entry) {
      if (doc.metadata.status === 'ACTA_CERRADA' && intent === 'close') {
        findings.push(
          finding(
            'SYNC_MISSING',
            'ERROR',
            'sync',
            `Sin entrada ledger para sync close v${version}`,
            'Programar calendarSync close o verificar ledger GAS idempotente.',
            { syncKeyString: keyString },
          ),
        )
      } else {
        findings.push(
          finding(
            'SYNC_INTENT_NOT_RECORDED',
            'WARNING',
            'sync',
            `Sin registro ledger para intent ${intent} v${version}`,
            'Confirmar si sync async aún pendiente.',
            { syncKeyString: keyString },
          ),
        )
      }
      continue
    }
    findings.push(...syncEntryFindings(entry))
  }

  const failedAny = ledger.filter((e) => e.status === 'FAILED' && e.syncKey.matchId === doc.match.matchId)
  for (const entry of failedAny) {
    if (!findings.some((f) => f.details?.syncKeyString === entry.syncKeyString)) {
      findings.push(
        finding(
          'SYNC_LEDGER_FAILED',
          'ERROR',
          'sync',
          `Ledger FAILED: ${entry.syncKeyString}`,
          'Reintentar sync tras corregir causa; revisar logs [calendarSyncHost].',
          { syncKeyString: entry.syncKeyString, lastError: entry.lastError },
        ),
      )
    }
  }

  const pending = ledger.filter(
    (e) => e.status === 'PENDING' && e.syncKey.matchId === doc.match.matchId,
  )
  for (const entry of pending) {
    findings.push(
      finding(
        'SYNC_PENDING',
        'WARNING',
        'sync',
        `Sync pendiente: ${entry.syncKeyString}`,
        'Esperar async o investigar transporte GAS.',
        { syncKeyString: entry.syncKeyString },
      ),
    )
  }

  if (doc.metadata.documentVersion > 1 && doc.metadata.status === 'ACTA_CERRADA') {
    const closeSuccess = ledger.some(
      (e) =>
        e.status === 'SUCCESS' &&
        e.syncKey.intent === 'close' &&
        e.syncKey.documentVersion === version,
    )
    if (!closeSuccess && !findings.some((f) => f.code === 'SYNC_MISSING')) {
      findings.push(
        finding(
          'SYNC_VERSION_GAP',
          'WARNING',
          'sync',
          `documentVersion ${version} sin sync close SUCCESS registrado`,
          'Verificar idempotencia GAS o ledger en memoria no persistido.',
        ),
      )
    }
  }

  return findings
}

function syncEntryFindings(entry: CalendarSyncLedgerEntry): ReconcileFinding[] {
  const status: CalendarSyncLedgerStatus = entry.status
  if (status === 'SUCCESS') {
    return [
      finding(
        'SYNC_OK',
        'INFO',
        'sync',
        `Sync SUCCESS: ${entry.syncKeyString}`,
        undefined,
        { syncKeyString: entry.syncKeyString },
      ),
    ]
  }
  if (status === 'FAILED') {
    return [
      finding(
        'SYNC_FAILED',
        'ERROR',
        'sync',
        `Sync FAILED: ${entry.syncKeyString}`,
        entry.lastError ?? 'Reintentar calendarSync',
        { syncKeyString: entry.syncKeyString, lastError: entry.lastError },
      ),
    ]
  }
  return [
    finding(
      'SYNC_PENDING',
      'WARNING',
      'sync',
      `Sync PENDING: ${entry.syncKeyString}`,
      'Completar transporte GAS.',
      { syncKeyString: entry.syncKeyString },
    ),
  ]
}

export function comparePdf(
  doc: ActaDocumentV1,
  calendar: CalendarOperationalSnapshot,
): readonly ReconcileFinding[] {
  const findings: ReconcileFinding[] = []
  const lastMode = doc.metadata.encounterWorkflow?.lastReopen?.mode as ReopenMode | undefined
  const openLike =
    calendar.matchStatus === 'acta_abierta' || calendar.matchStatus === 'alineacion_parcial'

  if (lastMode === 'REOPEN_ALIGNMENTS' || openLike) {
    if (calendar.pdfPresent === true) {
      findings.push(
        finding(
          'PDF_SHOULD_BE_ABSENT',
          'ERROR',
          'pdf',
          'PDF presente tras reopen_alignments o estado abierto/parcial',
          'Eliminar PDF en carpeta fase y limpiar columna PDF en Calendario.',
        ),
      )
    }
    if (calendar.pdfColumnSet === true) {
      findings.push(
        finding(
          'PDF_COLUMN_NOT_CLEARED',
          'WARNING',
          'pdf',
          'Columna PDF en Calendario no vacía tras reopen',
          'Limpiar celda PDF manualmente o re-sync reopen.',
        ),
      )
    }
  }

  if (doc.metadata.status === 'ACTA_CERRADA' && calendar.matchStatus === 'acta_cerrada') {
    if (calendar.pdfPresent === false) {
      findings.push(
        finding(
          'PDF_MISSING_WHEN_CLOSED',
          'WARNING',
          'pdf',
          'Acta cerrada sin PDF detectado en carpeta',
          'Regenerar PDF si es requisito federativo (no bloquea JSON).',
        ),
      )
    }
  }

  return findings
}

export function compareCopa(copa: CopaOperationalSnapshot | undefined): readonly ReconcileFinding[] {
  if (!copa) {
    return []
  }
  const findings: ReconcileFinding[] = []
  if (copa.placeholdersPending) {
    findings.push(
      finding(
        'COPA_PLACEHOLDERS_PENDING',
        'ERROR',
        'copa',
        'Placeholders COPA F2 no revertidos',
        'Ejecutar revert COPA antes de reabrir o cerrar.',
      ),
    )
  }
  if (copa.substitutionsNotReverted) {
    findings.push(
      finding(
        'COPA_SUBSTITUTIONS_STALE',
        'WARNING',
        'copa',
        'Sustituciones COPA posiblemente inconsistentes',
        'Revisar _cal_f2_revertirSustitucionesCopa_ en staging.',
      ),
    )
  }
  return findings
}

export function validateDocumentIntegrity(
  doc: ActaDocumentV1 | null,
  parseError?: string,
  expectedMatchId?: string,
): readonly ReconcileFinding[] {
  if (parseError) {
    return [
      finding(
        'DOCUMENT_PARSE_ERROR',
        'FATAL',
        'document',
        `Documento JSON no parseable: ${parseError}`,
        'Restaurar desde backup Drive o acta legacy.',
      ),
    ]
  }
  if (!doc) {
    return [
      finding(
        'DOCUMENT_MISSING',
        'FATAL',
        'document',
        'Sin documento JSON para el encuentro',
        'Verificar actaJson_readByMatchId o ruta Drive.',
      ),
    ]
  }

  const findings: ReconcileFinding[] = []
  const validation = validateActaDocument(doc, { expectedMatchId })
  if (!validation.ok) {
    for (const issue of validation.issues) {
      findings.push(
        finding(
          issue.code,
          issue.invariantId === 'F19' ? 'ERROR' : 'ERROR',
          'document',
          `[${issue.invariantId}] ${issue.message}`,
          'Corregir metadata JSON antes de sync.',
          { invariantId: issue.invariantId },
        ),
      )
    }
  }
  return findings
}

function aggregateStatus(findings: readonly ReconcileFinding[]): ActaCalendarReconcileStatus {
  if (findings.some((f) => f.severity === 'FATAL')) return 'FATAL'
  if (findings.some((f) => f.severity === 'ERROR')) return 'ERROR'
  if (findings.some((f) => f.severity === 'WARNING')) return 'WARNING'
  return 'OK'
}

function uniqueRecommendations(findings: readonly ReconcileFinding[]): string[] {
  const recs = findings
    .map((f) => f.recommendation)
    .filter((r): r is string => Boolean(r))
  return [...new Set(recs)]
}

/**
 * Ejecuta diagnóstico completo (solo lectura; no muta JSON ni Sheets).
 */
export interface EncounterWorkspaceReconcileInput
  extends Omit<ActaCalendarReconcileInput, 'document' | 'documentParseError'> {
  readonly workspace: EncounterWorkspaceDocumentV1 | null
  readonly workspaceParseError?: string
}

function validateWorkspaceIntegrity(
  workspace: EncounterWorkspaceDocumentV1 | null,
  workspaceParseError: string | undefined,
  matchId: string,
): readonly ReconcileFinding[] {
  const findings: ReconcileFinding[] = []
  if (workspaceParseError) {
    findings.push(
      finding(
        'WORKSPACE_PARSE_ERROR',
        'FATAL',
        'document',
        workspaceParseError,
        'Restaurar desde .previous / .backup o reparar JSON workspace.',
      ),
    )
    return findings
  }
  if (!workspace) {
    findings.push(
      finding(
        'WORKSPACE_MISSING',
        'WARNING',
        'document',
        'Encounter Workspace ausente en repositorio',
        'Materializar shell documental en próxima carga operacional.',
      ),
    )
    return findings
  }
  if (workspace.identity.matchId !== matchId) {
    findings.push(
      finding(
        'WORKSPACE_MATCH_ID_MISMATCH',
        'FATAL',
        'document',
        `workspace.matchId ${workspace.identity.matchId} ≠ entrada ${matchId}`,
      ),
    )
  }
  const validation = validateEncounterWorkspaceDocument(workspace, {
    expectedMatchId: matchId,
    strictMaterializePolicy: false,
    editIntent: 'read',
  })
  for (const issue of validation.issues.filter((i) => i.severity === 'error')) {
    findings.push(
      finding(
        `WS_${issue.invariantId}`,
        'ERROR',
        'document',
        issue.message,
        'Corregir workspace antes de sync.',
        { invariantId: issue.invariantId },
      ),
    )
  }
  if (workspace.acta && !shouldHydrateActaFromWorkspace(workspace)) {
    findings.push(
      finding(
        'WORKSPACE_ACTA_SUPERSEDED',
        'INFO',
        'binding',
        'acta embebida histórica (SUPERSEDED); runtime editable usa alignments documentales',
      ),
    )
  }
  return findings
}

/**
 * Reconcile sobre Encounter Workspace (proyecta acta ACTIVE para checks legacy).
 */
export function reconcileEncounterWorkspace(
  input: EncounterWorkspaceReconcileInput,
): ActaCalendarReconcileReport {
  const wsFindings = validateWorkspaceIntegrity(
    input.workspace,
    input.workspaceParseError,
    input.matchId,
  )
  const document =
    input.workspace && shouldHydrateActaFromWorkspace(input.workspace)
      ? actaDocumentV1FromWorkspace(input.workspace)
      : null

  const actaReport = reconcileActaCalendar({
    matchId: input.matchId,
    document,
    documentParseError: input.workspaceParseError,
    calendar: input.calendar,
    resultados: input.resultados,
    syncLedger: input.syncLedger,
    copa: input.copa,
    now: input.now,
  })

  const workspaceVersion = input.workspace?.metadata.workspaceVersion
  const mergedFindings = [...wsFindings, ...actaReport.findings]
  const status = aggregateStatus(mergedFindings)

  return {
    ...actaReport,
    documentVersion: workspaceVersion ?? actaReport.documentVersion,
    status,
    findings: mergedFindings,
    warnings: mergedFindings.filter((f) => f.severity === 'WARNING' || f.severity === 'INFO'),
    blockingIssues: mergedFindings.filter((f) => f.severity === 'ERROR' || f.severity === 'FATAL'),
    inconsistencies: mergedFindings.filter(
      (f) =>
        f.severity !== 'INFO' &&
        f.code !== 'SYNC_OK' &&
        f.code !== 'CLASSIFICATION_OFFICIAL_FROZEN',
    ),
    repairRecommendations: uniqueRecommendations(mergedFindings),
  }
}

export function reconcileActaCalendar(
  input: ActaCalendarReconcileInput,
): ActaCalendarReconcileReport {
  const checkedAt = input.now?.() ?? new Date().toISOString()
  const findings: ReconcileFinding[] = []

  findings.push(
    ...validateDocumentIntegrity(input.document, input.documentParseError, input.matchId),
  )

  const doc = input.document
  if (!doc || input.documentParseError) {
    const status = aggregateStatus(findings)
    return buildReport(input.matchId, undefined, status, findings, checkedAt)
  }

  if (doc.match.matchId !== input.matchId) {
    findings.push(
      finding(
        'MATCH_ID_INPUT_MISMATCH',
        'FATAL',
        'document',
        `matchId entrada ${input.matchId} ≠ documento ${doc.match.matchId}`,
        'Usar clave canónica del encuentro.',
      ),
    )
  }

  findings.push(...validateBinding(doc))

  if (input.calendar) {
    findings.push(...compareLifecycle(doc, input.calendar))
    findings.push(...compareWorkflow(doc, input.calendar))
    findings.push(...compareScores(doc, input.calendar, input.resultados))
    findings.push(...comparePdf(doc, input.calendar))
  } else {
    findings.push(
      finding(
        'CALENDAR_SNAPSHOT_MISSING',
        'WARNING',
        'lifecycle',
        'Sin snapshot Calendario — diagnóstico parcial',
        'Proveer lectura Calendario para comparación completa.',
      ),
    )
  }

  findings.push(...compareClassification(doc, input.resultados))
  findings.push(...validateSyncLedger(doc, input.syncLedger))
  findings.push(...compareCopa(input.copa))

  const status = aggregateStatus(findings)
  return buildReport(input.matchId, doc.metadata.documentVersion, status, findings, checkedAt)
}

function buildReport(
  matchId: string,
  documentVersion: number | undefined,
  status: ActaCalendarReconcileStatus,
  findings: readonly ReconcileFinding[],
  checkedAt: string,
): ActaCalendarReconcileReport {
  const warnings = findings.filter((f) => f.severity === 'WARNING' || f.severity === 'INFO')
  const blockingIssues = findings.filter((f) => f.severity === 'ERROR' || f.severity === 'FATAL')
  const inconsistencies = findings.filter(
    (f) =>
      f.severity !== 'INFO' &&
      f.code !== 'SYNC_OK' &&
      f.code !== 'CLASSIFICATION_OFFICIAL_FROZEN',
  )

  return {
    matchId,
    documentVersion,
    status,
    findings,
    warnings,
    blockingIssues,
    inconsistencies,
    repairRecommendations: uniqueRecommendations(findings),
    checkedAt,
  }
}

/** Resumen texto para logs operativos / CLI. */
export function formatReconcileReport(report: ActaCalendarReconcileReport): string {
  const lines = [
    `[reconcileActaCalendar] matchId=${report.matchId} status=${report.status} v=${report.documentVersion ?? '—'}`,
    `checkedAt=${report.checkedAt}`,
    `findings=${report.findings.length} blocking=${report.blockingIssues.length}`,
  ]
  for (const f of report.blockingIssues) {
    lines.push(`  [${f.severity}] ${f.code}: ${f.message}`)
  }
  for (const f of report.warnings.filter((w) => w.severity === 'WARNING')) {
    lines.push(`  [WARN] ${f.code}: ${f.message}`)
  }
  if (report.repairRecommendations.length) {
    lines.push('recommendations:')
    for (const r of report.repairRecommendations) {
      lines.push(`  - ${r}`)
    }
  }
  return lines.join('\n')
}
