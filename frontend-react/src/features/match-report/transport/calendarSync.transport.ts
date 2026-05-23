/**
 * Transporte GAS real para `CalendarSyncPort`.
 */

import { log, logTransportFailure } from '@/core/debug'
import { gasTransport } from '@/transport/gasTransport'
import type {
  CalendarSyncCommandBundle,
  CalendarSyncExecuteResult,
  CalendarSyncPort,
} from '../contracts/calendarSync.contract'
import {
  bundleToWire,
  validateCalendarSyncBundleWire,
  type CalendarSyncBundleWire,
} from './calendarSyncWire'

const GAS_APPLY = 'calendarSync_applyBundle'
const TRANSPORT_LOG = 'calendarSyncTransport'
const DEFAULT_TIMEOUT_MS = 45_000

export interface CalendarSyncGasApplyResponse {
  readonly ok: boolean
  readonly syncKeyString?: string
  readonly status?: 'SUCCESS' | 'FAILED'
  readonly stepsExecuted?: number
  readonly code?: string
  readonly message?: string
  readonly duplicate?: boolean
}

export interface CalendarSyncTransportOptions {
  readonly timeoutMs?: number
}

function logTransport(event: string, detail?: Record<string, unknown>): void {
  log.debug(`[${TRANSPORT_LOG}] ${event}`, detail ?? {})
}

function mapGasResponse(
  wire: CalendarSyncBundleWire,
  raw: CalendarSyncGasApplyResponse,
): CalendarSyncExecuteResult {
  const syncKeyString = raw.syncKeyString ?? wire.syncKeyString
  if (raw.ok) {
    return {
      ok: true,
      syncKeyString,
      status: 'SUCCESS',
      stepsExecuted: raw.stepsExecuted ?? wire.steps.length,
      message: raw.duplicate ? 'ALREADY_SYNCED' : raw.message,
    }
  }
  return {
    ok: false,
    syncKeyString,
    status: 'FAILED',
    stepsExecuted: raw.stepsExecuted ?? 0,
    message: raw.message ?? raw.code ?? 'calendarSync_applyBundle failed',
  }
}

/**
 * Invoca `calendarSync_applyBundle` en GAS con el bundle proyectado (forma wire).
 */
export async function applyCalendarSyncBundle(
  bundle: CalendarSyncCommandBundle,
  options: CalendarSyncTransportOptions = {},
): Promise<CalendarSyncExecuteResult> {
  const wire = bundleToWire(bundle)
  const syncKeyString = wire.syncKeyString

  logTransport('apply.start', {
    syncKeyString,
    intent: wire.syncKey.intent,
    steps: wire.steps.length,
  })

  try {
    const raw = await gasTransport.call<CalendarSyncGasApplyResponse>(
      GAS_APPLY,
      wire,
      { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS },
    )

    if (raw == null || typeof raw !== 'object') {
      logTransport('apply.invalidResponse', { syncKeyString })
      return {
        ok: false,
        syncKeyString,
        status: 'FAILED',
        stepsExecuted: 0,
        message: 'Respuesta GAS inválida',
      }
    }

    const result = mapGasResponse(wire, raw)
    if (result.ok) {
      logTransport('apply.success', {
        syncKeyString,
        stepsExecuted: result.stepsExecuted,
        duplicate: raw.duplicate === true,
      })
    } else {
      logTransport('apply.failure', {
        syncKeyString,
        message: result.message,
        code: raw.code,
      })
    }
    return result
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const isTimeout = message.includes('Timeout')
    logTransport(isTimeout ? 'timeout' : 'apply.error', { syncKeyString, message })
    logTransportFailure(`${TRANSPORT_LOG}.${isTimeout ? 'timeout' : 'error'}`, {
      syncKeyString,
      message,
    })
    return {
      ok: false,
      syncKeyString,
      status: 'FAILED',
      stepsExecuted: 0,
      message,
    }
  }
}

export function createGasCalendarSyncTransportPort(
  options: CalendarSyncTransportOptions = {},
): CalendarSyncPort {
  return {
    execute(bundle) {
      return applyCalendarSyncBundle(bundle, options)
    },
  }
}

export { validateCalendarSyncBundleWire, bundleToWire }
