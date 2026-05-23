/**
 * Único punto de contacto con `google.script.run`.
 * Sin lógica de negocio; solo invocación, promesas, timeout y errores de transporte.
 *
 * - `MODE === 'gas'` (build:gas / Web App): siempre `google.script.run` real.
 * - `MODE !== 'gas'` (npm run dev): despacha a `mockGasHandlers` — no válido para staging federativo.
 */

import { isLocalSpaDevMode } from '@/app/localDevMode'
import { log, logTransportFailure } from '@/core/debug'
import { dispatchLocalDevMockGasCall } from './localDev/mockGasHandlers'

const DEFAULT_TIMEOUT_MS = 30_000

export interface GasCallOptions {
  timeoutMs?: number
}

/** Referencia no opcional a `google.script.run` tras comprobar entorno (solo build GAS). */
function getGasRun() {
  const run = window.google?.script?.run
  if (!run) {
    const err = new Error(
      'Entorno GAS no detectado: `google.script.run` no está disponible (¿SPA fuera del iframe de Apps Script?).',
    )
    logTransportFailure('gasTransport.missingHost', { message: err.message })
    throw err
  }
  return run
}

function toError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason
  }
  if (typeof reason === 'string') {
    return new Error(reason)
  }
  if (reason && typeof reason === 'object' && 'message' in reason) {
    const msg = (reason as { message?: unknown }).message
    if (typeof msg === 'string') {
      return new Error(msg)
    }
  }
  return new Error('Error desconocido en la llamada a GAS')
}

async function callGasViaMock<T>(functionName: string, args: unknown[]): Promise<T> {
  log.debug('localDev.transport.call', { functionName, argCount: args.length })
  const result = await dispatchLocalDevMockGasCall(functionName, args)
  return result as T
}

/**
 * Invoca una función del servidor GAS por nombre y devuelve el resultado tipado.
 */
export async function callGas<T>(functionName: string, args: unknown[], options?: GasCallOptions): Promise<T> {
  if (isLocalSpaDevMode()) {
    return callGasViaMock<T>(functionName, args)
  }

  const run = getGasRun()
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      const err = new Error(`Timeout (${String(timeoutMs)} ms) esperando respuesta de GAS: ${functionName}`)
      logTransportFailure('gasTransport.timeout', { functionName, timeoutMs })
      reject(err)
    }, timeoutMs)

    const finish = (action: () => void) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timer)
      action()
    }

    const afterSuccess = run.withSuccessHandler((result: unknown) => {
      finish(() => {
        resolve(result as T)
      })
    })
    const afterFailure = afterSuccess.withFailureHandler((error: unknown) => {
      finish(() => {
        const err = toError(error)
        logTransportFailure('gasTransport.failureHandler', {
          functionName,
          message: err.message,
        })
        reject(err)
      })
    })

    const serverFn = (afterFailure as Record<string, unknown>)[functionName]
    if (typeof serverFn !== 'function') {
      finish(() => {
        const err = new Error(`La función GAS "${functionName}" no está expuesta en google.script.run`)
        logTransportFailure('gasTransport.fnMissing', { functionName })
        reject(err)
      })
      return
    }

    try {
      ;(serverFn as (...a: unknown[]) => void).apply(afterFailure, args)
    } catch (e) {
      finish(() => {
        const err = toError(e)
        logTransportFailure('gasTransport.applyThrow', { functionName, message: err.message })
        reject(err)
      })
    }
  })
}

export const gasTransport = {
  call<T>(functionName: string, ...args: unknown[]): Promise<T> {
    return callGas<T>(functionName, args)
  },
} as const
