/**
 * Logging centralizado para validación manual y depuración.
 * Activación: `VITE_ETR7_DEBUG=true` | `1`, o por defecto en `import.meta.env.DEV` salvo `VITE_ETR7_DEBUG=false` | `0`.
 * No usar `console.*` dispersos en features; preferir `log.*` aquí.
 */

const PREFIX = '[ETR7]'

/** `true` si se emiten logs (debug / warn / error vía este módulo). */
export function isEtr7DebugLoggingEnabled(): boolean {
  const v = import.meta.env.VITE_ETR7_DEBUG
  if (v === 'false' || v === '0') return false
  if (v === 'true' || v === '1') return true
  return import.meta.env.DEV
}

function emit(
  level: 'debug' | 'warn' | 'error',
  scope: string,
  detail?: Readonly<Record<string, unknown>>,
): void {
  if (!isEtr7DebugLoggingEnabled()) return
  const payload = detail === undefined ? [PREFIX, scope] : [PREFIX, scope, detail]
  if (level === 'debug') {
    console.debug(...payload)
    return
  }
  if (level === 'warn') {
    console.warn(...payload)
    return
  }
  console.error(...payload)
}

/**
 * Error de transporte / red: siempre visible en consola (validación manual en GAS),
 * independiente de `VITE_ETR7_DEBUG`. Usar solo en el boundary de transporte.
 */
export function logTransportFailure(scope: string, detail?: Readonly<Record<string, unknown>>): void {
  if (detail === undefined) {
    console.error(PREFIX, scope)
  } else {
    console.error(PREFIX, scope, detail)
  }
}

/** Logger único de aplicación (capas no-UI). */
export const log = {
  debug(scope: string, detail?: Readonly<Record<string, unknown>>): void {
    emit('debug', scope, detail)
  },
  warn(scope: string, detail?: Readonly<Record<string, unknown>>): void {
    emit('warn', scope, detail)
  },
  error(scope: string, detail?: Readonly<Record<string, unknown>>): void {
    emit('error', scope, detail)
  },
} as const
