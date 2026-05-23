import { describe, expect, it } from 'vitest'
import { projectActaDocumentToCalendarSyncBundle } from '../adapters/calendarSync.adapter'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import { buildCalendarSyncKeyString } from '../contracts/calendarSync.contract'
import type { CalendarSyncCommandBundle } from '../contracts/calendarSync.contract'
import { createFakeDriveJsonPersistenceRepository } from '../infra/jsonPersistence.adapter'
import { createActaBootstrapAdapter } from '../infra/actaBootstrap.adapter'
import { EncounterWorkspaceRepository } from '../persistence/encounterWorkspace.repository'
import { legacyActaDocumentToWorkspace } from '../adapters/workspaceActa.mapper'
import { matchKeyFromContext } from '../persistence/matchKey'
import { closeActaJson } from '../services/actaPersistence.service'
import {
  CalendarSyncService,
  createInMemoryCalendarSyncLedger,
  createRecordingCalendarSyncPort,
} from '../services/calendarSync.service'
import { defaultEncounterWorkflow } from '../utils/encounterWorkflow'
import { adaptLoadMatchReportResponse } from '../adapters/match-report.mapper'
import { recalculateMatchReport } from '../domain/scoring'
import { baseContext, emptyMatchReport, playerLine } from './fixtures'
import { matchKeyFromContext } from '../infra/actaBootstrap.adapter'
import { clearActaPersistenceSession } from '../services/actaPersistenceSession'

function reportWithActions() {
  const context = baseContext()
  let report = emptyMatchReport(context)
  report = {
    ...report,
    local: {
      ...report.local,
      players: [playerLine('A', 1, { E: 1 }, { titular: true }), ...report.local.players.slice(1)],
    },
  }
  return report
}

describe('calendarSync.service', () => {
  it('12. idempotent sync — duplicate ignored', async () => {
    const doc = closedDocument()
    const ledger = createInMemoryCalendarSyncLedger()
    const executed: CalendarSyncCommandBundle[] = []
    const service = new CalendarSyncService({
      ledger,
      port: createRecordingCalendarSyncPort(executed),
      maxRetries: 1,
    })

    const first = service.schedule(doc, 'close')
    await new Promise((r) => setTimeout(r, 0))
    const second = service.schedule(doc, 'close')
    expect(first.scheduled).toBe(true)
    expect(second.duplicate).toBe(true)
    expect(executed).toHaveLength(1)
  })

  it('13. duplicate sync ignored tras SUCCESS en ledger', () => {
    const doc = closedDocument()
    const gate = new CalendarSyncService().canSyncDocument(doc, 'close')
    expect(gate.ok).toBe(true)
    const bundle = projectActaDocumentToCalendarSyncBundle(doc, 'close')
    const key = buildCalendarSyncKeyString(bundle.syncKey)
    const ledger = createInMemoryCalendarSyncLedger()
    ledger.set(key, {
      syncKey: bundle.syncKey,
      syncKeyString: key,
      intent: 'close',
      status: 'SUCCESS',
      retries: 0,
      createdAt: 't',
      updatedAt: 't',
    })
    const service = new CalendarSyncService({ ledger })
    const result = service.schedule(doc, 'close')
    expect(result.scheduled).toBe(false)
    expect(result.duplicate).toBe(true)
  })

  it('14. failed sync ledger', async () => {
    const doc = closedDocument()
    const ledger = createInMemoryCalendarSyncLedger()
    const service = new CalendarSyncService({
      ledger,
      port: {
        async execute() {
          return {
            ok: false,
            syncKeyString: 'fail',
            status: 'FAILED',
            stepsExecuted: 0,
            message: 'simulated',
          }
        },
      },
      maxRetries: 1,
    })
    const bundle = projectActaDocumentToCalendarSyncBundle(doc, 'close')!
    const key = buildCalendarSyncKeyString(bundle.syncKey)
    await service.execute(bundle)
    const entry = service.getLedgerEntry(key)
    expect(entry?.status).toBe('FAILED')
    expect(entry?.lastError).toBeDefined()
  })

  it('15. retry conceptual tras FAILED', async () => {
    const doc = closedDocument()
    const ledger = createInMemoryCalendarSyncLedger()
    let calls = 0
    const service = new CalendarSyncService({
      ledger,
      port: {
        async execute(bundle) {
          calls += 1
          if (calls === 1) {
            return {
              ok: false,
              syncKeyString: buildCalendarSyncKeyString(bundle.syncKey),
              status: 'FAILED',
              stepsExecuted: 0,
            }
          }
          return {
            ok: true,
            syncKeyString: buildCalendarSyncKeyString(bundle.syncKey),
            status: 'SUCCESS',
            stepsExecuted: bundle.steps.length,
          }
        },
      },
      maxRetries: 1,
    })
    const bundle = projectActaDocumentToCalendarSyncBundle(doc, 'close')!
    const key = buildCalendarSyncKeyString(bundle.syncKey)
    await service.execute(bundle)
    const retry = await service.retryFailed(key, doc)
    expect(retry.ok).toBe(true)
    expect(service.getLedgerEntry(key)?.status).toBe('SUCCESS')
  })

  it('16. pending sync tracking', async () => {
    const doc = closedDocument()
    const ledger = createInMemoryCalendarSyncLedger()
    const service = new CalendarSyncService({
      ledger,
      maxRetries: 1,
      port: {
        async execute(bundle) {
          await new Promise((r) => setTimeout(r, 10))
          return {
            ok: true,
            syncKeyString: buildCalendarSyncKeyString(bundle.syncKey),
            status: 'SUCCESS',
            stepsExecuted: 1,
          }
        },
      },
    })
    const scheduled = service.schedule(doc, 'close')
    expect(scheduled.scheduled).toBe(true)
    const key = scheduled.syncKeyString!
    expect(service.getLedgerEntry(key)?.status).toBe('PENDING')
    await new Promise((r) => setTimeout(r, 25))
    expect(service.getLedgerEntry(key)?.status).toBe('SUCCESS')
  })

  it('17. invalid JSON blocks sync — SUPERSEDED close', () => {
    const doc = {
      ...closedDocument(),
      metadata: {
        ...closedDocument().metadata,
        encounterWorkflow: { actaBinding: 'SUPERSEDED' as const },
      },
    }
    const service = new CalendarSyncService()
    const gate = service.canSyncDocument(doc, 'close')
    expect(gate.ok).toBe(false)
  })

  it('close JSON schedules calendar sync tras persistencia', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const report = recalculateMatchReport(emptyMatchReport(baseContext()))
    const context = report.context
    clearActaPersistenceSession(context.encuentroId)
    const { saveActaDraftJson } = await import('../services/actaPersistence.service')
    const draft = await saveActaDraftJson(report, { repository: repo })
    expect(draft.kind).toBe('success')
    const close = await closeActaJson(report, { repository: repo })
    expect(close.kind).toBe('success')

    const closed = await repo.load(matchKeyFromContext(context))
    expect(closed).not.toBeNull()
    expect(closed!.metadata.status).toBe('ACTA_CERRADA')

    const ledger = createInMemoryCalendarSyncLedger()
    const executed: CalendarSyncCommandBundle[] = []
    const scheduled = new CalendarSyncService({
      ledger,
      port: createRecordingCalendarSyncPort(executed),
    }).schedule(closed, 'close')
    await new Promise((r) => setTimeout(r, 0))
    expect(scheduled.scheduled).toBe(true)
    expect(executed[0]?.syncKey.intent).toBe('close')
  })
})

describe('workspace SUPERSEDED', () => {
  it('2. SUPERSEDED hidrata desde alignments documentales', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = baseContext()
    const doc = projectMatchReportToActaDocument({
      metadata: {
        schemaVersion: 1,
        documentVersion: 1,
        status: 'ACTA_CERRADA',
        createdAt: '2026-05-21T12:00:00.000Z',
        updatedAt: '2026-05-21T12:00:00.000Z',
        closedAt: '2026-05-21T13:00:00.000Z',
        encounterWorkflow: { actaBinding: 'SUPERSEDED' },
      },
      report: emptyMatchReport(context),
      encounterNumber: 5,
      documentName: buildActaDocumentName('Fase I', 5),
    })
    repo.driveStore.injectRawWorkspace(matchKeyFromContext(context), legacyActaDocumentToWorkspace(doc))

    const bootstrap = createActaBootstrapAdapter({
      workspaceRepository: new EncounterWorkspaceRepository(repo.driveStore),
    })
    const result = await bootstrap.load({ context })
    expect(result.source).toBe('workspace_alignments')
    expect(result.report.fromActaSnapshot).toBe(false)
  })
})

function closedDocument() {
  const report = recalculateMatchReport(reportWithActions())
  const now = '2026-05-21T12:00:00.000Z'
  return projectMatchReportToActaDocument({
    metadata: {
      schemaVersion: 1,
      documentVersion: 2,
      status: 'ACTA_CERRADA',
      createdAt: now,
      updatedAt: now,
      closedAt: now,
      encounterWorkflow: defaultEncounterWorkflow(),
    },
    report: { ...report, cerrada: true },
    encounterNumber: 10,
    documentName: buildActaDocumentName('Fase I', 10),
  })
}

