import { describe, expect, it } from 'vitest'
import { projectActaDocumentToCalendarSyncBundle } from '../adapters/calendarSync.adapter'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import type { ActaDocumentMetadata } from '../contracts'
import { defaultEncounterWorkflow } from '../utils/encounterWorkflow'
import { baseContext, emptyMatchReport } from './fixtures'

function closedDoc() {
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

describe('calendarSync.adapter', () => {
  const doc = closedDoc()

  it('5. close bundle — marcador, acta_cerrada, resultados, COPA, recalc', () => {
    const bundle = projectActaDocumentToCalendarSyncBundle(doc, 'close')
    expect(bundle.syncKey.intent).toBe('close')
    expect(bundle.row.resultadoLocal).toBe(12)
    expect(bundle.row.resultadoVisitante).toBe(7)
    expect(bundle.row.estadoPartido).toBe('acta_cerrada')
    expect(bundle.row.estadoAlineacionLocal).toBe('F')
    expect(bundle.resultados?.local.P).toBe(3)
    expect(bundle.steps.some((s) => s.type === 'WRITE_RESULTADOS_ROWS')).toBe(true)
    expect(bundle.steps.some((s) => s.type === 'REVERT_COPA_PLACEHOLDERS')).toBe(true)
    expect(bundle.steps.some((s) => s.type === 'RECALC_GLOBAL_CLASSIFICATION')).toBe(true)
    expect(bundle.documentPatch).toBeUndefined()
  })

  it('6. reopen_acta bundle — limpia marcador, acta_abierta, mantiene C/C', () => {
    const bundle = projectActaDocumentToCalendarSyncBundle(doc, 'reopen_acta', {
      reopenedBy: 'admin',
    })
    expect(bundle.row.resultadoLocal).toBeNull()
    expect(bundle.row.resultadoVisitante).toBeNull()
    expect(bundle.row.estadoPartido).toBe('acta_abierta')
    expect(bundle.row.estadoAlineacionLocal).toBe('C')
    expect(bundle.steps.some((s) => s.type === 'DELETE_RESULTADOS_ROWS')).toBe(true)
    expect(bundle.steps.some((s) => s.type === 'REVERT_COPA_PLACEHOLDERS')).toBe(true)
    expect(bundle.documentPatch?.actaBinding).toBe('ACTIVE')
    expect(bundle.documentPatch?.lastReopen?.mode).toBe('REOPEN_ACTA')
  })

  it('7. reopen_alignments bundle — alineacion_parcial, SUPERSEDED', () => {
    const bundle = projectActaDocumentToCalendarSyncBundle(doc, 'reopen_alignments', {
      reopenAlcance: 'L',
      reopenedBy: 'staff',
    })
    expect(bundle.row.estadoPartido).toBe('alineacion_parcial')
    expect(bundle.row.estadoAlineacionLocal).toBe('E')
    expect(bundle.row.estadoAlineacionVisitante).toBe('C')
    expect(bundle.row.clearPdfColumn).toBe(true)
    expect(bundle.documentPatch?.actaBinding).toBe('SUPERSEDED')
    expect(bundle.documentPatch?.lastReopen?.mode).toBe('REOPEN_ALIGNMENTS')
    expect(bundle.documentPatch?.lastReopen?.alcance).toBe('L')
    expect(bundle.steps.some((s) => s.type === 'TRASH_PDF')).toBe(true)
    expect(bundle.resultados).toBeUndefined()
  })

  it('8. alignment_complete bundle — acta_abierta sin patch JSON', () => {
    const bundle = projectActaDocumentToCalendarSyncBundle(doc, 'alignment_complete')
    expect(bundle.row.estadoPartido).toBe('acta_abierta')
    expect(bundle.documentPatch).toBeUndefined()
    expect(bundle.steps).toHaveLength(2)
  })

  it('9. classification projection usa official si existe', () => {
    const withOfficial = {
      ...doc,
      classification: {
        local: { P: 1, BO: 0, BD: 0, Total: 1 },
        visitante: { P: 0, BO: 0, BD: 0, Total: 0 },
        official: {
          local: { P: 5, BO: 1, BD: 0, Total: 6 },
          visitante: { P: 0, BO: 0, BD: 2, Total: 2 },
          source: 'server' as const,
          appliedAt: '2026-05-21T14:00:00.000Z',
        },
      },
    }
    const bundle = projectActaDocumentToCalendarSyncBundle(withOfficial, 'close')
    expect(bundle.resultados?.local.Total).toBe(6)
    expect(bundle.resultados?.visitante.BD).toBe(2)
  })

  it('10. marker cleanup en reopen intents', () => {
    const reopenActa = projectActaDocumentToCalendarSyncBundle(doc, 'reopen_acta')
    const reopenAlign = projectActaDocumentToCalendarSyncBundle(doc, 'reopen_alignments')
    expect(reopenActa.row.resultadoLocal).toBeNull()
    expect(reopenAlign.row.resultadoVisitante).toBeNull()
  })

  it('11. COPA revert step presente en close y reopens', () => {
    for (const intent of ['close', 'reopen_acta', 'reopen_alignments'] as const) {
      const bundle = projectActaDocumentToCalendarSyncBundle(doc, intent)
      expect(bundle.steps[0]?.type).toBe('REVERT_COPA_PLACEHOLDERS')
    }
  })
})
