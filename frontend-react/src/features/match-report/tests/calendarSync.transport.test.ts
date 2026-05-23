import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { projectActaDocumentToCalendarSyncBundle } from '../adapters/calendarSync.adapter'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import type { ActaDocumentMetadata } from '../contracts'
import {
  applyCalendarSyncBundle,
  createGasCalendarSyncTransportPort,
} from '../transport/calendarSync.transport'
import { bundleToWire } from '../transport/calendarSyncWire'
import { gasTransport } from '@/transport/gasTransport'
import { defaultEncounterWorkflow } from '../utils/encounterWorkflow'
import { baseContext, emptyMatchReport } from './fixtures'

vi.mock('@/transport/gasTransport', () => ({
  gasTransport: {
    call: vi.fn(),
  },
}))

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

describe('calendarSync.transport', () => {
  const mockedCall = vi.mocked(gasTransport.call)

  beforeEach(() => {
    mockedCall.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('1. apply bundle success', async () => {
    const bundle = projectActaDocumentToCalendarSyncBundle(closedDoc(), 'close')
    const wire = bundleToWire(bundle)
    mockedCall.mockResolvedValue({
      ok: true,
      syncKeyString: wire.syncKeyString,
      status: 'SUCCESS',
      stepsExecuted: 5,
    })

    const result = await applyCalendarSyncBundle(bundle)
    expect(result.ok).toBe(true)
    expect(result.status).toBe('SUCCESS')
    expect(result.stepsExecuted).toBe(5)
    expect(mockedCall).toHaveBeenCalledWith('calendarSync_applyBundle', wire, {
      timeoutMs: 45_000,
    })
  })

  it('2. timeout propagates as failed result', async () => {
    const bundle = projectActaDocumentToCalendarSyncBundle(closedDoc(), 'close')
    mockedCall.mockRejectedValue(new Error('Timeout (100 ms) esperando respuesta de GAS: calendarSync_applyBundle'))

    const result = await applyCalendarSyncBundle(bundle, { timeoutMs: 100 })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('Timeout')
    expect(result.stepsExecuted).toBe(0)
  })

  it('3. apply failure from GAS response', async () => {
    const bundle = projectActaDocumentToCalendarSyncBundle(closedDoc(), 'close')
    mockedCall.mockResolvedValue({
      ok: false,
      code: 'APPLY_ERROR',
      message: 'Encuentro no encontrado',
      syncKeyString: bundleToWire(bundle).syncKeyString,
      status: 'FAILED',
      stepsExecuted: 0,
    })

    const result = await applyCalendarSyncBundle(bundle)
    expect(result.ok).toBe(false)
    expect(result.message).toBe('Encuentro no encontrado')
  })

  it('4. typed error propagation on transport throw', async () => {
    const bundle = projectActaDocumentToCalendarSyncBundle(closedDoc(), 'close')
    mockedCall.mockRejectedValue(new Error('La función GAS "calendarSync_applyBundle" no está expuesta'))

    const port = createGasCalendarSyncTransportPort()
    const result = await port.execute(bundle)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('no está expuesta')
  })
})
