/**
 * A5 — Telemetría UX operacional (soporte / staging QA).
 */

import { getStagingRuntimeTraceId } from '../tools/stagingRuntimeLogger'
import { shouldLogStagingRuntime } from '../tools/stagingRuntimeLogger'

export type UxOperationalChannel = 'STALE' | 'SUPERSEDED' | 'RECOVERY' | 'CONCURRENT'

const PREFIX: Record<UxOperationalChannel, string> = {
  STALE: '[UX-STALE]',
  SUPERSEDED: '[UX-SUPERSEDED]',
  RECOVERY: '[UX-RECOVERY]',
  CONCURRENT: '[UX-CONCURRENT]',
}

export function shouldLogUxOperational(): boolean {
  return shouldLogStagingRuntime()
}

export function logUxOperational(
  channel: UxOperationalChannel,
  event: string,
  detail?: Readonly<Record<string, unknown>>,
): void {
  if (!shouldLogUxOperational()) return
  // eslint-disable-next-line no-console
  console.info(PREFIX[channel], {
    traceId: getStagingRuntimeTraceId(),
    event,
    at: new Date().toISOString(),
    ...detail,
  })
}
