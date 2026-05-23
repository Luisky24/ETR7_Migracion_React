/**
 * Simulación local de `calendarSync_applyBundle` (idempotencia + shape mínima).
 */

import type { CalendarSyncGasApplyResponse } from '@/features/match-report/transport/calendarSync.transport'
import {
  validateCalendarSyncBundleWire,
  type CalendarSyncBundleWire,
} from '@/features/match-report/transport/calendarSyncWire'

const appliedSyncKeys = new Set<string>()

/** Reset entre tests (vitest setup). */
export function resetMockCalendarSyncIdempotency(): void {
  appliedSyncKeys.clear()
}

export type MockCalendarSyncAppliedOp =
  | 'REVERT_COPA'
  | 'WRITE_RESULTADOS'
  | 'DELETE_RESULTADOS'
  | 'UPDATE_CALENDAR_ROW'
  | 'RECALC_GLOBAL'
  | 'TRASH_PDF'
  | 'INVALIDATE_CACHE'

export interface MockCalendarSyncApplyRecord {
  readonly syncKeyString: string
  readonly intent: string
  readonly ops: readonly MockCalendarSyncAppliedOp[]
}

const applyLog: MockCalendarSyncApplyRecord[] = []

export function getMockCalendarSyncApplyLog(): readonly MockCalendarSyncApplyRecord[] {
  return applyLog
}

export function clearMockCalendarSyncApplyLog(): void {
  applyLog.length = 0
}

let simulateFailure: { readonly code: string; readonly message: string } | null = null

export function setMockCalendarSyncSimulateFailure(
  failure: { readonly code: string; readonly message: string } | null,
): void {
  simulateFailure = failure
}

function opsForIntent(intent: string, wire: CalendarSyncBundleWire): MockCalendarSyncAppliedOp[] {
  switch (intent) {
    case 'close':
      return [
        'REVERT_COPA',
        ...(wire.resultados ? (['WRITE_RESULTADOS'] as const) : []),
        'UPDATE_CALENDAR_ROW',
        'RECALC_GLOBAL',
        'INVALIDATE_CACHE',
      ]
    case 'reopen_acta':
      return [
        'REVERT_COPA',
        'DELETE_RESULTADOS',
        'TRASH_PDF',
        'UPDATE_CALENDAR_ROW',
        'INVALIDATE_CACHE',
      ]
    case 'reopen_alignments':
      return [
        'REVERT_COPA',
        'DELETE_RESULTADOS',
        ...(wire.row.clearPdfColumn ? (['TRASH_PDF'] as const) : []),
        'UPDATE_CALENDAR_ROW',
        'RECALC_GLOBAL',
        'INVALIDATE_CACHE',
      ]
    case 'alignment_complete':
      return ['UPDATE_CALENDAR_ROW', 'INVALIDATE_CACHE']
    default:
      return []
  }
}

export async function mockCalendarSyncApplyBundle(
  bundleWire: unknown,
): Promise<CalendarSyncGasApplyResponse> {
  const shape = validateCalendarSyncBundleWire(bundleWire)
  if (!shape.ok) {
    return {
      ok: false,
      code: shape.code,
      message: shape.message,
      syncKeyString: '',
      status: 'FAILED',
      stepsExecuted: 0,
    }
  }

  const wire = shape.bundle
  if (simulateFailure) {
    return {
      ok: false,
      code: simulateFailure.code,
      message: simulateFailure.message,
      syncKeyString: wire.syncKeyString,
      status: 'FAILED',
      stepsExecuted: 0,
    }
  }

  if (appliedSyncKeys.has(wire.syncKeyString)) {
    return {
      ok: true,
      syncKeyString: wire.syncKeyString,
      status: 'SUCCESS',
      stepsExecuted: 0,
      duplicate: true,
      message: 'ALREADY_SYNCED',
    }
  }

  const ops = opsForIntent(wire.syncKey.intent, wire)
  appliedSyncKeys.add(wire.syncKeyString)
  applyLog.push({
    syncKeyString: wire.syncKeyString,
    intent: wire.syncKey.intent,
    ops,
  })

  return {
    ok: true,
    syncKeyString: wire.syncKeyString,
    status: 'SUCCESS',
    stepsExecuted: ops.length,
    duplicate: false,
  }
}
