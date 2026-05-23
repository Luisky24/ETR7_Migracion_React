import { isLocalSpaDevMode } from '@/app/localDevMode'

export type QaRuntimeOperation = 'load' | 'save' | 'finalize'

export type QaRuntimeFailureKind = 'recoverable' | 'fatal'

/** Flags en `window.__ETR7_QA__` (solo SPA dev / mock; ignorado en MODE gas). */
export interface Etr7QaRuntimeFlags {
  readonly failLoadOnce?: boolean
  readonly failSaveOnce?: boolean
  readonly failFinalizeOnce?: boolean
  readonly failLoadFatalOnce?: boolean
  readonly failSaveFatalOnce?: boolean
  readonly failFinalizeFatalOnce?: boolean
}

export const ETR7_QA_LOG_PREFIX = '[ETR7_QA]' as const

export interface QaSimulatedErrorTag {
  readonly operation: QaRuntimeOperation
  readonly kind: QaRuntimeFailureKind
}

export interface QaTaggedError extends Error {
  __etr7Qa?: QaSimulatedErrorTag
}

const RECOVERABLE_FLAG: Record<QaRuntimeOperation, keyof Etr7QaRuntimeFlags> = {
  load: 'failLoadOnce',
  save: 'failSaveOnce',
  finalize: 'failFinalizeOnce',
}

const FATAL_FLAG: Record<QaRuntimeOperation, keyof Etr7QaRuntimeFlags> = {
  load: 'failLoadFatalOnce',
  save: 'failSaveFatalOnce',
  finalize: 'failFinalizeFatalOnce',
}

let testFlagsOverride: Etr7QaRuntimeFlags | null = null

export function isQaRuntimeSimulationEnabled(): boolean {
  if (testFlagsOverride !== null) return true
  if (!isLocalSpaDevMode()) return false
  return typeof window !== 'undefined'
}

function readFlags(): Etr7QaRuntimeFlags | undefined {
  if (testFlagsOverride) return testFlagsOverride
  if (typeof window === 'undefined') return undefined
  return window.__ETR7_QA__
}

function writeFlags(next: Etr7QaRuntimeFlags | undefined): void {
  if (testFlagsOverride) {
    testFlagsOverride = next ?? {}
    return
  }
  if (typeof window !== 'undefined') {
    window.__ETR7_QA__ = next
  }
}

function consumeFlag(key: keyof Etr7QaRuntimeFlags): boolean {
  const flags = readFlags()
  if (!flags?.[key]) return false
  writeFlags({ ...flags, [key]: false })
  return true
}

function logQaSimulation(message: string): void {
  // eslint-disable-next-line no-console -- QA manual instrumentation
  console.info(`${ETR7_QA_LOG_PREFIX} ${message}`)
}

export function createQaSimulatedError(
  operation: QaRuntimeOperation,
  kind: QaRuntimeFailureKind,
): QaTaggedError {
  const label =
    kind === 'recoverable'
      ? `${ETR7_QA_LOG_PREFIX} simulated ${operation} failure (recoverable, once): Timeout esperando GAS (QA)`
      : `${ETR7_QA_LOG_PREFIX} simulated ${operation} failure (fatal, once): Falta referencia de encuentro (QA)`

  const err = new Error(label) as QaTaggedError
  err.name = 'QaSimulatedRuntimeError'
  err.__etr7Qa = { operation, kind }
  return err
}

export function isQaSimulatedError(error: unknown): error is QaTaggedError {
  if (!error || typeof error !== 'object') return false
  if ('__etr7Qa' in error && (error as QaTaggedError).__etr7Qa) return true
  return error instanceof Error && error.message.includes(ETR7_QA_LOG_PREFIX)
}

/**
 * Si hay flag activa para la operación, lanza error simulado y consume la flag (una vez).
 * Llamar al inicio de mock load/save/close únicamente.
 */
export function assertQaRuntimeSimulation(operation: QaRuntimeOperation): void {
  if (!isQaRuntimeSimulationEnabled()) return

  const fatalKey = FATAL_FLAG[operation]
  if (consumeFlag(fatalKey)) {
    logQaSimulation(`simulated ${operation} failure (fatal, once)`)
    throw createQaSimulatedError(operation, 'fatal')
  }

  const recoverableKey = RECOVERABLE_FLAG[operation]
  if (consumeFlag(recoverableKey)) {
    logQaSimulation(`simulated ${operation} failure (recoverable, once)`)
    throw createQaSimulatedError(operation, 'recoverable')
  }
}

export function armQaRuntimeFlags(flags: Etr7QaRuntimeFlags): void {
  if (!isQaRuntimeSimulationEnabled()) {
    logQaSimulation('flags ignored (production gas mode or no window)')
    return
  }
  writeFlags({ ...readFlags(), ...flags })
  logQaSimulation(`armed ${JSON.stringify(flags)}`)
}

export function resetQaRuntimeSimulation(): void {
  testFlagsOverride = null
  if (typeof window !== 'undefined') {
    delete window.__ETR7_QA__
  }
}

/** Solo tests: inyectar flags sin `window`. */
export function __setQaRuntimeFlagsForTest(flags: Etr7QaRuntimeFlags | null): void {
  testFlagsOverride = flags
}
