import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { projectActaDocumentToCalendarSyncBundle } from '../adapters/calendarSync.adapter'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import type { ActaDocumentMetadata } from '../contracts'
import { bundleToWire } from '../transport/calendarSyncWire'
import {
  clearMockCalendarSyncApplyLog,
  getMockCalendarSyncApplyLog,
  mockCalendarSyncApplyBundle,
  resetMockCalendarSyncIdempotency,
  setMockCalendarSyncSimulateFailure,
} from '@/transport/localDev/mockCalendarSyncGas'
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

describe('calendarSync GAS host (mock)', () => {
  beforeEach(() => {
    resetMockCalendarSyncIdempotency()
    clearMockCalendarSyncApplyLog()
    setMockCalendarSyncSimulateFailure(null)
  })

  afterEach(() => {
    setMockCalendarSyncSimulateFailure(null)
  })

  it('5. close bundle application', async () => {
    const wire = bundleToWire(projectActaDocumentToCalendarSyncBundle(closedDoc(), 'close'))
    const res = await mockCalendarSyncApplyBundle(wire)
    expect(res.ok).toBe(true)
    const log = getMockCalendarSyncApplyLog()[0]
    expect(log?.intent).toBe('close')
    expect(log?.ops).toContain('WRITE_RESULTADOS')
    expect(log?.ops).toContain('RECALC_GLOBAL')
    expect(log?.ops).toContain('REVERT_COPA')
  })

  it('6. reopen_acta application', async () => {
    const wire = bundleToWire(
      projectActaDocumentToCalendarSyncBundle(closedDoc(), 'reopen_acta', { reopenedBy: 'admin' }),
    )
    const res = await mockCalendarSyncApplyBundle(wire)
    expect(res.ok).toBe(true)
    const log = getMockCalendarSyncApplyLog()[0]
    expect(log?.ops).toEqual([
      'REVERT_COPA',
      'DELETE_RESULTADOS',
      'TRASH_PDF',
      'UPDATE_CALENDAR_ROW',
      'INVALIDATE_CACHE',
    ])
  })

  it('7. reopen_alignments application', async () => {
    const wire = bundleToWire(
      projectActaDocumentToCalendarSyncBundle(closedDoc(), 'reopen_alignments', {
        reopenAlcance: 'L',
        reopenedBy: 'staff',
      }),
    )
    const res = await mockCalendarSyncApplyBundle(wire)
    expect(res.ok).toBe(true)
    const log = getMockCalendarSyncApplyLog()[0]
    expect(log?.ops).toContain('DELETE_RESULTADOS')
    expect(log?.ops).toContain('TRASH_PDF')
    expect(log?.ops).toContain('RECALC_GLOBAL')
  })

  it('8. alignment_complete application', async () => {
    const wire = bundleToWire(
      projectActaDocumentToCalendarSyncBundle(closedDoc(), 'alignment_complete'),
    )
    const res = await mockCalendarSyncApplyBundle(wire)
    expect(res.ok).toBe(true)
    expect(getMockCalendarSyncApplyLog()[0]?.ops).toEqual([
      'UPDATE_CALENDAR_ROW',
      'INVALIDATE_CACHE',
    ])
  })

  it('9. idempotent syncKey — second call duplicate', async () => {
    const wire = bundleToWire(projectActaDocumentToCalendarSyncBundle(closedDoc(), 'close'))
    const first = await mockCalendarSyncApplyBundle(wire)
    const second = await mockCalendarSyncApplyBundle(wire)
    expect(first.duplicate).toBeFalsy()
    expect(second.duplicate).toBe(true)
    expect(second.message).toBe('ALREADY_SYNCED')
    expect(getMockCalendarSyncApplyLog()).toHaveLength(1)
  })

  it('10. duplicate ignored as success', async () => {
    const wire = bundleToWire(projectActaDocumentToCalendarSyncBundle(closedDoc(), 'close'))
    await mockCalendarSyncApplyBundle(wire)
    const dup = await mockCalendarSyncApplyBundle(wire)
    expect(dup.ok).toBe(true)
    expect(dup.stepsExecuted).toBe(0)
  })

  it('11. marker cleanup ops on reopen intents', async () => {
    const reopenActa = bundleToWire(
      projectActaDocumentToCalendarSyncBundle(closedDoc(), 'reopen_acta'),
    )
    const reopenAlign = bundleToWire(
      projectActaDocumentToCalendarSyncBundle(closedDoc(), 'reopen_alignments'),
    )
    expect(reopenActa.row.resultadoLocal).toBeNull()
    expect(reopenAlign.row.resultadoVisitante).toBeNull()
    await mockCalendarSyncApplyBundle(reopenActa)
    await mockCalendarSyncApplyBundle(reopenAlign)
    expect(getMockCalendarSyncApplyLog().every((e) => e.ops.includes('DELETE_RESULTADOS'))).toBe(
      true,
    )
  })

  it('12. Resultados cleanup + COPA revert on reopen', async () => {
    const wire = bundleToWire(projectActaDocumentToCalendarSyncBundle(closedDoc(), 'reopen_acta'))
    await mockCalendarSyncApplyBundle(wire)
    const log = getMockCalendarSyncApplyLog()[0]
    expect(log?.ops[0]).toBe('REVERT_COPA')
    expect(log?.ops).toContain('DELETE_RESULTADOS')
  })

  it('13. clasificación recalc on close and reopen_alignments', async () => {
    const closeWire = bundleToWire(projectActaDocumentToCalendarSyncBundle(closedDoc(), 'close'))
    await mockCalendarSyncApplyBundle(closeWire)
    resetMockCalendarSyncIdempotency()
    clearMockCalendarSyncApplyLog()
    const alignWire = bundleToWire(
      projectActaDocumentToCalendarSyncBundle(closedDoc(), 'reopen_alignments'),
    )
    await mockCalendarSyncApplyBundle(alignWire)
    expect(getMockCalendarSyncApplyLog()[0]?.ops).toContain('RECALC_GLOBAL')
  })

  it('14. GAS failure returns typed code', async () => {
    setMockCalendarSyncSimulateFailure({ code: 'APPLY_ERROR', message: 'Sheets lock' })
    const wire = bundleToWire(projectActaDocumentToCalendarSyncBundle(closedDoc(), 'close'))
    const res = await mockCalendarSyncApplyBundle(wire)
    expect(res.ok).toBe(false)
    expect(res.code).toBe('APPLY_ERROR')
    expect(res.message).toBe('Sheets lock')
    expect(getMockCalendarSyncApplyLog()).toHaveLength(0)
  })
})
