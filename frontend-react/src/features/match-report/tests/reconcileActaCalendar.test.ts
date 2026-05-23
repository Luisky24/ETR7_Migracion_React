import { describe, expect, it } from 'vitest'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import type { ActaDocumentMetadata } from '../contracts'
import { buildCalendarSyncKeyString } from '../contracts/calendarSync.contract'
import type { CalendarSyncLedgerEntry } from '../contracts/calendarSync.contract'
import {
  buildLastReopenAudit,
  defaultEncounterWorkflow,
} from '../utils/encounterWorkflow'
import {
  reconcileActaCalendar,
  type ActaCalendarReconcileInput,
  type CalendarOperationalSnapshot,
  type ResultadosOperationalSnapshot,
} from '../tools/reconcileActaCalendar'
import { baseContext, emptyMatchReport } from './fixtures'

function closedDoc(overrides: Partial<ActaDocumentMetadata> = {}) {
  const context = baseContext({ matchStatus: 'acta_cerrada' })
  const report = emptyMatchReport(context)
  const now = '2026-05-21T12:00:00.000Z'
  const metadata: ActaDocumentMetadata = {
    schemaVersion: 1,
    documentVersion: 2,
    status: 'ACTA_CERRADA',
    createdAt: now,
    updatedAt: now,
    closedAt: '2026-05-21T13:00:00.000Z',
    closedBy: 'runtime',
    encounterWorkflow: defaultEncounterWorkflow(),
    ...overrides,
  }
  return projectMatchReportToActaDocument({
    metadata,
    report: {
      ...report,
      cerrada: true,
      score: { local: 12, visitante: 7 },
      local: { ...report.local, classification: { P: 3, BO: 0, BD: 0, Total: 3 } },
      visitante: { ...report.visitante, classification: { P: 0, BO: 0, BD: 1, Total: 1 } },
    },
    encounterNumber: 14,
    documentName: buildActaDocumentName('Fase I', 14),
  })
}

function calendarClosed(overrides: Partial<CalendarOperationalSnapshot> = {}): CalendarOperationalSnapshot {
  return {
    matchStatus: 'acta_cerrada',
    resultadoLocal: 12,
    resultadoVisitante: 7,
    estadoAlineacionLocal: 'F',
    estadoAlineacionVisitante: 'F',
    pdfPresent: true,
    ...overrides,
  }
}

function resultadosClosed(): ResultadosOperationalSnapshot {
  return {
    rowsPresent: true,
    resultadoLocal: 12,
    resultadoVisitante: 7,
    localClassification: { P: 3, BO: 0, BD: 0, Total: 3 },
    visitanteClassification: { P: 0, BO: 0, BD: 1, Total: 1 },
  }
}

function baseInput(
  partial: Partial<ActaCalendarReconcileInput> & { document: ActaCalendarReconcileInput['document'] },
): ActaCalendarReconcileInput {
  const doc = partial.document
  const matchId = doc?.match.matchId ?? partial.matchId ?? 'A|LOCAL|VISITANTE'
  return {
    matchId,
    document: doc,
    calendar: partial.calendar ?? null,
    resultados: partial.resultados ?? null,
    syncLedger: partial.syncLedger ?? [],
    copa: partial.copa,
    documentParseError: partial.documentParseError,
    now: () => '2026-05-21T15:00:00.000Z',
  }
}

function closeLedgerEntry(
  doc: ReturnType<typeof closedDoc>,
  status: CalendarSyncLedgerEntry['status'],
): CalendarSyncLedgerEntry {
  const syncKey = {
    category: doc.match.category,
    phase: doc.match.phase,
    matchId: doc.match.matchId,
    documentVersion: doc.metadata.documentVersion,
    intent: 'close' as const,
  }
  return {
    syncKey,
    syncKeyString: buildCalendarSyncKeyString(syncKey),
    intent: 'close',
    status,
    retries: status === 'FAILED' ? 3 : 0,
    lastError: status === 'FAILED' ? 'simulated GAS error' : undefined,
    createdAt: 't',
    updatedAt: 't',
  }
}

describe('reconcileActaCalendar', () => {
  it('1. lifecycle mismatch — JSON cerrado, Calendario abierto', () => {
    const doc = closedDoc()
    const report = reconcileActaCalendar(
      baseInput({
        document: doc,
        calendar: {
          matchStatus: 'acta_abierta',
          resultadoLocal: null,
          resultadoVisitante: null,
        },
      }),
    )
    expect(report.status).toBe('ERROR')
    expect(report.blockingIssues.some((f) => f.code === 'JSON_CLOSED_CALENDAR_OPEN')).toBe(true)
  })

  it('2. SUPERSEDED mismatch — REOPEN_ALIGNMENTS sin SUPERSEDED', () => {
    const doc = closedDoc({
      encounterWorkflow: {
        actaBinding: 'ACTIVE',
        lastReopen: buildLastReopenAudit({
          mode: 'REOPEN_ALIGNMENTS',
          at: '2026-05-21T14:00:00.000Z',
          by: 'admin',
          fromDocumentVersion: 2,
          alcance: 'A',
        }),
      },
    })
    const report = reconcileActaCalendar(
      baseInput({
        document: doc,
        calendar: { matchStatus: 'alineacion_parcial', resultadoLocal: null, resultadoVisitante: null },
      }),
    )
    expect(report.blockingIssues.some((f) => f.code === 'REOPEN_ALIGNMENTS_BINDING')).toBe(true)
  })

  it('3. score mismatch — marcador Calendario divergente', () => {
    const doc = closedDoc()
    const report = reconcileActaCalendar(
      baseInput({
        document: doc,
        calendar: calendarClosed({ resultadoLocal: 99 }),
        resultados: resultadosClosed(),
      }),
    )
    expect(report.blockingIssues.some((f) => f.code === 'SCORE_CALENDAR_MISMATCH')).toBe(true)
  })

  it('4. classification mismatch — Resultados vs JSON oficial', () => {
    const doc = closedDoc({
      encounterWorkflow: defaultEncounterWorkflow(),
    })
    const withOfficial = {
      ...doc,
      classification: {
        ...doc.classification,
        official: {
          local: { P: 5, BO: 0, BD: 0, Total: 5 },
          visitante: { P: 0, BO: 0, BD: 2, Total: 2 },
          source: 'server' as const,
          appliedAt: '2026-05-21T14:00:00.000Z',
        },
      },
    }
    const report = reconcileActaCalendar(
      baseInput({
        document: withOfficial,
        calendar: calendarClosed(),
        resultados: {
          rowsPresent: true,
          resultadoLocal: 12,
          resultadoVisitante: 7,
          localClassification: { P: 3, BO: 0, BD: 0, Total: 3 },
          visitanteClassification: { P: 0, BO: 0, BD: 1, Total: 1 },
        },
      }),
    )
    expect(report.warnings.some((f) => f.code === 'CLASSIFICATION_RESULTADOS_MISMATCH')).toBe(true)
  })

  it('5. sync pending', () => {
    const doc = closedDoc()
    const report = reconcileActaCalendar(
      baseInput({
        document: doc,
        calendar: calendarClosed(),
        resultados: resultadosClosed(),
        syncLedger: [closeLedgerEntry(doc, 'PENDING')],
      }),
    )
    expect(report.warnings.some((f) => f.code === 'SYNC_PENDING')).toBe(true)
  })

  it('6. sync failed', () => {
    const doc = closedDoc()
    const report = reconcileActaCalendar(
      baseInput({
        document: doc,
        calendar: calendarClosed(),
        syncLedger: [closeLedgerEntry(doc, 'FAILED')],
      }),
    )
    expect(report.blockingIssues.some((f) => f.code === 'SYNC_FAILED')).toBe(true)
  })

  it('7. corrupt document — parse error', () => {
    const report = reconcileActaCalendar(
      baseInput({
        matchId: 'X|A|B',
        document: null,
        documentParseError: 'Unexpected token',
      }),
    )
    expect(report.status).toBe('FATAL')
    expect(report.blockingIssues[0]?.code).toBe('DOCUMENT_PARSE_ERROR')
  })

  it('8. invalid binding value', () => {
    const doc = closedDoc({
      encounterWorkflow: {
        actaBinding: 'ACTIVE' as 'ACTIVE',
        lastReopen: undefined,
      },
    })
    const broken = {
      ...doc,
      metadata: {
        ...doc.metadata,
        encounterWorkflow: { actaBinding: 'INVALID' as 'ACTIVE', lastReopen: undefined },
      },
    }
    const report = reconcileActaCalendar(
      baseInput({
        document: broken,
        calendar: calendarClosed(),
      }),
    )
    expect(report.blockingIssues.some((f) => f.code === 'INVALID_ACTA_BINDING')).toBe(true)
  })

  it('9. PDF inconsistency tras reopen', () => {
    const doc = closedDoc({
      status: 'ACTA_CERRADA',
      encounterWorkflow: {
        actaBinding: 'SUPERSEDED',
        lastReopen: buildLastReopenAudit({
          mode: 'REOPEN_ALIGNMENTS',
          at: '2026-05-21T14:00:00.000Z',
          by: 'admin',
          fromDocumentVersion: 2,
          alcance: 'L',
        }),
      },
    })
    const report = reconcileActaCalendar(
      baseInput({
        document: doc,
        calendar: {
          matchStatus: 'alineacion_parcial',
          resultadoLocal: null,
          resultadoVisitante: null,
          pdfPresent: true,
        },
      }),
    )
    expect(report.blockingIssues.some((f) => f.code === 'PDF_SHOULD_BE_ABSENT')).toBe(true)
  })

  it('10. clean state success', () => {
    const doc = closedDoc()
    const report = reconcileActaCalendar(
      baseInput({
        document: doc,
        calendar: calendarClosed(),
        resultados: resultadosClosed(),
        syncLedger: [closeLedgerEntry(doc, 'SUCCESS')],
      }),
    )
    expect(report.status).toBe('OK')
    expect(report.blockingIssues).toHaveLength(0)
    expect(report.findings.some((f) => f.code === 'SYNC_OK')).toBe(true)
  })
})
