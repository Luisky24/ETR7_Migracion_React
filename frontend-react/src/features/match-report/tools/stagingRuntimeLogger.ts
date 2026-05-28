/**
 * A4.4 — Logs operacionales staging (GAS/WebApp). Correlables vía traceId.
 */

import { isStagingGasRuntime } from '@/app/runtimeProfile'

export type StagingRuntimeLogChannel = 'RUNTIME' | 'STALE' | 'SUPERSEDED' | 'RECONCILE'

const CHANNEL_PREFIX: Record<StagingRuntimeLogChannel, string> = {
  RUNTIME: '[STAGING-RUNTIME]',
  STALE: '[STAGING-STALE]',
  SUPERSEDED: '[STAGING-SUPERSEDED]',
  RECONCILE: '[STAGING-RECONCILE]',
}

let stagingTraceId = `etr7-${Date.now().toString(36)}`

export function shouldLogStagingRuntime(): boolean {
  if (import.meta.env.DEV) return true
  return isStagingGasRuntime()
}

export function getStagingRuntimeTraceId(): string {
  return stagingTraceId
}

export function resetStagingRuntimeTraceId(forMatchId?: string): string {
  stagingTraceId = forMatchId ? `etr7-${forMatchId.slice(0, 12)}` : `etr7-${Date.now().toString(36)}`
  return stagingTraceId
}

export function logStagingRuntime(
  channel: StagingRuntimeLogChannel,
  event: string,
  detail?: Readonly<Record<string, unknown>>,
): void {
  if (!shouldLogStagingRuntime()) return
  // eslint-disable-next-line no-console
  console.info(CHANNEL_PREFIX[channel], {
    traceId: stagingTraceId,
    event,
    at: new Date().toISOString(),
    ...detail,
  })
}

export function logStagingRuntimeHydrate(detail: Readonly<Record<string, unknown>>): void {
  logStagingRuntime('RUNTIME', 'hydrate', detail)
}

export function logStagingStale(detail: Readonly<Record<string, unknown>>): void {
  logStagingRuntime('STALE', 'detected', detail)
}

export function logStagingSuperseded(detail: Readonly<Record<string, unknown>>): void {
  logStagingRuntime('SUPERSEDED', 'detected', detail)
}

export function logStagingReconcile(detail: Readonly<Record<string, unknown>>): void {
  logStagingRuntime('RECONCILE', 'findings', detail)
}
