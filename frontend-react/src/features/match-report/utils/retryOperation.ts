import { normalizeOperationError } from './errorNormalizer'
import { isQaSimulatedError } from './qaRuntimeSimulation'
import { matchReportRuntimeLog } from './runtimeLogger'

export interface RetryOptions {
  readonly maxAttempts?: number
  readonly delayMs?: number
  readonly shouldRetry?: (error: unknown, attempt: number) => boolean
}

const DEFAULT_MAX = 2
const DEFAULT_DELAY = 400

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function defaultShouldRetry(error: unknown): boolean {
  if (isQaSimulatedError(error)) return false
  const n = normalizeOperationError(error)
  return n.retryable
}

/**
 * Ejecuta operación async con reintentos (hooks/servicios — no reducer).
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  label: string,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX
  const delayMs = options?.delayMs ?? DEFAULT_DELAY
  const shouldRetry = options?.shouldRetry ?? defaultShouldRetry

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (e) {
      lastError = e
      const retry = attempt < maxAttempts && shouldRetry(e, attempt)
      matchReportRuntimeLog.retry(label, {
        attempt,
        maxAttempts,
        willRetry: retry,
        message: e instanceof Error ? e.message : String(e),
      })
      if (!retry) break
      await delay(delayMs * attempt)
    }
  }
  throw lastError
}
