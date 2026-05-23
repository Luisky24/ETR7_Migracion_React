/**
 * Orquestación sync Calendario ← JSON: ledger, idempotencia, retry conceptual.
 * No bloquea runtime React; transporte inyectable (mock hasta GAS real).
 */

import { log } from '@/core/debug'
import { projectActaDocumentToCalendarSyncBundle } from '../adapters/calendarSync.adapter'
import type { ActaDocumentV1 } from '../contracts/actaDocument'
import type {
  CalendarSyncCommandBundle,
  CalendarSyncExecuteResult,
  CalendarSyncLedgerEntry,
  CalendarSyncPort,
  CalendarSyncScheduleResult,
  ProjectCalendarSyncOptions,
} from '../contracts/calendarSync.contract'
import { buildCalendarSyncKeyString } from '../contracts/calendarSync.contract'
import type { CalendarSyncIntent } from '../contracts/encounterWorkflow.contract'
import { validateActaDocument } from '../persistence/documentValidators'
import { createGasCalendarSyncTransportPort } from '../transport/calendarSync.transport'
import { getActaBinding, shouldHydrateFromJsonDocument } from '../utils/encounterWorkflow'

const SYNC_LOG = 'calendarSync'

export interface CalendarSyncServiceOptions {
  readonly port?: CalendarSyncPort
  readonly maxRetries?: number
  readonly now?: () => string
  readonly ledger?: Map<string, CalendarSyncLedgerEntry>
}

function logSync(event: string, detail?: Record<string, unknown>): void {
  log.debug(`[${SYNC_LOG}] ${event}`, detail ?? {})
}

/** Ledger en memoria (tests / dev hasta persistencia GAS). */
export function createInMemoryCalendarSyncLedger(): Map<string, CalendarSyncLedgerEntry> {
  return new Map()
}

export class CalendarSyncService {
  private readonly port: CalendarSyncPort
  private readonly maxRetries: number
  private readonly now: () => string
  private readonly ledger: Map<string, CalendarSyncLedgerEntry>

  constructor(options: CalendarSyncServiceOptions = {}) {
    this.port = options.port ?? createGasCalendarSyncTransportPort()
    this.maxRetries = options.maxRetries ?? 3
    this.now = options.now ?? (() => new Date().toISOString())
    this.ledger = options.ledger ?? createInMemoryCalendarSyncLedger()
  }

  getLedgerEntry(syncKeyString: string): CalendarSyncLedgerEntry | undefined {
    return this.ledger.get(syncKeyString)
  }

  getAllLedgerEntries(): readonly CalendarSyncLedgerEntry[] {
    return [...this.ledger.values()]
  }

  /**
   * Valida documento y binding antes de proyectar/sync.
   */
  canSyncDocument(
    document: ActaDocumentV1,
    intent: CalendarSyncIntent,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
    const validation = validateActaDocument(document, { expectedMatchId: document.match.matchId })
    if (!validation.ok) {
      return { ok: false, reason: 'INVALID_DOCUMENT' }
    }
    if (!document.match.encounter.grupo || !document.match.encounter.equipoLocal) {
      return { ok: false, reason: 'MISSING_ROW_KEY' }
    }
    const binding = getActaBinding(document)
    if (intent === 'close' && binding === 'SUPERSEDED') {
      return { ok: false, reason: 'BINDING_SUPERSEDED' }
    }
    if (intent === 'close' && document.metadata.status !== 'ACTA_CERRADA') {
      return { ok: false, reason: 'LIFECYCLE_VIOLATION' }
    }
    if (intent === 'reopen_acta' && document.metadata.status !== 'ACTA_CERRADA') {
      return { ok: false, reason: 'LIFECYCLE_VIOLATION' }
    }
    if (!shouldHydrateFromJsonDocument(document) && intent === 'close') {
      return { ok: false, reason: 'BINDING_SUPERSEDED' }
    }
    return { ok: true }
  }

  projectBundle(
    document: ActaDocumentV1,
    intent: CalendarSyncIntent,
    options?: ProjectCalendarSyncOptions,
  ): CalendarSyncCommandBundle | null {
    const gate = this.canSyncDocument(document, intent)
    if (!gate.ok) {
      logSync('project.blocked', { intent, reason: gate.reason, matchId: document.match.matchId })
      return null
    }
    return projectActaDocumentToCalendarSyncBundle(document, intent, options)
  }

  /**
   * Programa sync sin bloquear caller (fire-and-forget).
   */
  schedule(
    document: ActaDocumentV1,
    intent: CalendarSyncIntent,
    options?: ProjectCalendarSyncOptions,
  ): CalendarSyncScheduleResult {
    const gate = this.canSyncDocument(document, intent)
    if (!gate.ok) {
      logSync('schedule.blocked', { intent, reason: gate.reason })
      return {
        scheduled: false,
        blocked: true,
        blockReason: mapBlockReason(gate.reason),
      }
    }

    const bundle = projectActaDocumentToCalendarSyncBundle(document, intent, options)
    const syncKeyString = buildCalendarSyncKeyString(bundle.syncKey)
    const existing = this.ledger.get(syncKeyString)
    if (existing?.status === 'SUCCESS') {
      logSync('schedule.duplicate', { syncKeyString })
      return { scheduled: false, duplicate: true, syncKeyString }
    }

    const timestamp = this.now()
    const entry: CalendarSyncLedgerEntry = {
      syncKey: bundle.syncKey,
      syncKeyString,
      intent,
      status: 'PENDING',
      retries: existing?.retries ?? 0,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    this.ledger.set(syncKeyString, entry)
    logSync('schedule.enqueued', { syncKeyString, intent, steps: bundle.steps.length })

    void this.executePending(syncKeyString, bundle)
    return { scheduled: true, syncKeyString }
  }

  /**
   * Ejecuta sync con reintentos conceptuales (ledger FAILED → retry).
   */
  async execute(bundle: CalendarSyncCommandBundle): Promise<CalendarSyncExecuteResult> {
    const syncKeyString = buildCalendarSyncKeyString(bundle.syncKey)
    return this.executePending(syncKeyString, bundle)
  }

  async retryFailed(syncKeyString: string, document: ActaDocumentV1): Promise<CalendarSyncExecuteResult> {
    const entry = this.ledger.get(syncKeyString)
    if (!entry || entry.status !== 'FAILED') {
      return {
        ok: false,
        syncKeyString,
        status: 'FAILED',
        stepsExecuted: 0,
        message: 'No hay entrada FAILED para reintentar',
      }
    }
    const bundle = projectActaDocumentToCalendarSyncBundle(document, entry.intent)
    return this.executePending(syncKeyString, bundle, true)
  }

  private async executePending(
    syncKeyString: string,
    bundle: CalendarSyncCommandBundle,
    isRetry = false,
  ): Promise<CalendarSyncExecuteResult> {
    const prev = this.ledger.get(syncKeyString)
    const retries = (prev?.retries ?? 0) + (isRetry ? 1 : 0)
    const timestamp = this.now()

    this.ledger.set(syncKeyString, {
      syncKey: bundle.syncKey,
      syncKeyString,
      intent: bundle.syncKey.intent,
      status: 'PENDING',
      retries,
      createdAt: prev?.createdAt ?? timestamp,
      updatedAt: timestamp,
    })

    let lastError: string | undefined
    let stepsExecuted = 0
    const attempts = isRetry ? 1 : this.maxRetries

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const result = await this.port.execute(bundle)
        stepsExecuted = result.stepsExecuted
        if (result.ok) {
          this.ledger.set(syncKeyString, {
            syncKey: bundle.syncKey,
            syncKeyString,
            intent: bundle.syncKey.intent,
            status: 'SUCCESS',
            retries: retries + attempt,
            createdAt: prev?.createdAt ?? timestamp,
            updatedAt: this.now(),
          })
          logSync('execute.ok', { syncKeyString, stepsExecuted })
          return { ok: true, syncKeyString, status: 'SUCCESS', stepsExecuted }
        }
        lastError = result.message ?? 'execute returned not ok'
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
      }
      logSync('execute.retry', { syncKeyString, attempt: attempt + 1, lastError })
    }

    this.ledger.set(syncKeyString, {
      syncKey: bundle.syncKey,
      syncKeyString,
      intent: bundle.syncKey.intent,
      status: 'FAILED',
      retries: retries + attempts,
      lastError,
      createdAt: prev?.createdAt ?? timestamp,
      updatedAt: this.now(),
    })
    logSync('execute.failed', { syncKeyString, lastError })
    return {
      ok: false,
      syncKeyString,
      status: 'FAILED',
      stepsExecuted,
      message: lastError,
    }
  }
}

let defaultCalendarSyncService: CalendarSyncService | null = null

export function getCalendarSyncService(): CalendarSyncService {
  if (!defaultCalendarSyncService) {
    defaultCalendarSyncService = new CalendarSyncService()
  }
  return defaultCalendarSyncService
}

export function setCalendarSyncService(service: CalendarSyncService): void {
  defaultCalendarSyncService = service
}

export function resetCalendarSyncService(): void {
  defaultCalendarSyncService = null
}

/**
 * API de scheduling post-persistencia JSON (no await — no bloquea runtime).
 */
export function scheduleCalendarSyncAfterPersist(
  document: ActaDocumentV1,
  intent: CalendarSyncIntent,
  options?: CalendarSyncServiceOptions & ProjectCalendarSyncOptions,
): CalendarSyncScheduleResult {
  const service = new CalendarSyncService(options)
  return service.schedule(document, intent, options)
}

function mapBlockReason(
  reason: string,
): CalendarSyncScheduleResult['blockReason'] {
  if (reason === 'INVALID_DOCUMENT') return 'INVALID_DOCUMENT'
  if (reason === 'BINDING_SUPERSEDED') return 'BINDING_SUPERSEDED'
  if (reason === 'LIFECYCLE_VIOLATION') return 'LIFECYCLE_VIOLATION'
  if (reason === 'MISSING_ROW_KEY') return 'MISSING_ROW_KEY'
  return 'INVALID_DOCUMENT'
}

/** Puerto mock que registra bundles ejecutados (tests). */
export function createRecordingCalendarSyncPort(
  executed: CalendarSyncCommandBundle[],
): CalendarSyncPort {
  return {
    async execute(bundle) {
      executed.push(bundle)
      return {
        ok: true,
        syncKeyString: buildCalendarSyncKeyString(bundle.syncKey),
        status: 'SUCCESS',
        stepsExecuted: bundle.steps.length,
      }
    },
  }
}
