/**
 * Forma wire serializable para `calendarSync_applyBundle` (sin documento JSON completo).
 */

import type {
  CalendarEncounterRowKey,
  CalendarRowProjection,
  CalendarSyncCommandBundle,
  CalendarSyncKey,
  CalendarSyncStep,
  ResultadosClassificationProjection,
} from '../contracts/calendarSync.contract'
import { buildCalendarSyncKeyString } from '../contracts/calendarSync.contract'

export interface CalendarSyncBundleWire {
  readonly syncKey: CalendarSyncKey
  readonly syncKeyString: string
  readonly rowKey: CalendarEncounterRowKey
  readonly row: CalendarRowProjection
  readonly resultados?: ResultadosClassificationProjection
  readonly steps: readonly CalendarSyncStep[]
}

export function bundleToWire(bundle: CalendarSyncCommandBundle): CalendarSyncBundleWire {
  return {
    syncKey: bundle.syncKey,
    syncKeyString: buildCalendarSyncKeyString(bundle.syncKey),
    rowKey: bundle.rowKey,
    row: bundle.row,
    resultados: bundle.resultados,
    steps: bundle.steps,
  }
}

export type CalendarSyncWireValidationCode =
  | 'MISSING_BUNDLE'
  | 'MISSING_SYNC_KEY'
  | 'MISSING_ROW_KEY'
  | 'MISSING_ROW'
  | 'INVALID_INTENT'

export function validateCalendarSyncBundleWire(
  wire: unknown,
): { readonly ok: true; readonly bundle: CalendarSyncBundleWire } | { readonly ok: false; readonly code: CalendarSyncWireValidationCode; readonly message: string } {
  if (wire == null || typeof wire !== 'object') {
    return { ok: false, code: 'MISSING_BUNDLE', message: 'Bundle ausente' }
  }
  const b = wire as CalendarSyncBundleWire
  if (!b.syncKey || !b.syncKey.matchId || !b.syncKey.intent) {
    return { ok: false, code: 'MISSING_SYNC_KEY', message: 'syncKey incompleto' }
  }
  if (!b.rowKey?.grupo || !b.rowKey.equipoLocal || !b.rowKey.equipoVisitante) {
    return { ok: false, code: 'MISSING_ROW_KEY', message: 'rowKey incompleto' }
  }
  if (!b.row?.estadoPartido) {
    return { ok: false, code: 'MISSING_ROW', message: 'row projection ausente' }
  }
  const intents = ['close', 'reopen_acta', 'reopen_alignments', 'alignment_complete']
  if (intents.indexOf(b.syncKey.intent) < 0) {
    return { ok: false, code: 'INVALID_INTENT', message: 'intent no soportado' }
  }
  return {
    ok: true,
    bundle: {
      ...b,
      syncKeyString: b.syncKeyString || buildCalendarSyncKeyString(b.syncKey),
      steps: b.steps ?? [],
    },
  }
}
