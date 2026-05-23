/**
 * Logging técnico del runtime Acta — sin contaminar dominio.
 * Dedupe en operaciones repetidas (p. ej. load.skipped durante estabilización).
 */

import { log } from '@/core/debug'

const PREFIX = 'matchReport.runtime'
const DEDUPE_MS = 2_000
const lastOperationLogAt = new Map<string, number>()

function shouldEmitOperationLog(scope: string): boolean {
  const now = Date.now()
  const last = lastOperationLogAt.get(scope) ?? 0
  if (now - last < DEDUPE_MS) {
    return false
  }
  lastOperationLogAt.set(scope, now)
  return true
}

export const matchReportRuntimeLog = {
  operation(scope: string, detail?: Readonly<Record<string, unknown>>): void {
    if (!shouldEmitOperationLog(scope)) {
      return
    }
    log.debug(`${PREFIX}.operation.${scope}`, detail)
  },
  guard(scope: string, detail?: Readonly<Record<string, unknown>>): void {
    log.debug(`${PREFIX}.guard.${scope}`, detail)
  },
  recovery(scope: string, detail?: Readonly<Record<string, unknown>>): void {
    log.debug(`${PREFIX}.recovery.${scope}`, detail)
  },
  error(scope: string, detail?: Readonly<Record<string, unknown>>): void {
    log.error(`${PREFIX}.error.${scope}`, detail)
  },
  retry(scope: string, detail?: Readonly<Record<string, unknown>>): void {
    log.debug(`${PREFIX}.retry.${scope}`, detail)
  },
} as const

/** Solo tests: reinicia dedupe de operación. */
export function resetMatchReportRuntimeLogDedupeForTests(): void {
  lastOperationLogAt.clear()
}
