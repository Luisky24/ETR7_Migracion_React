/**
 * Modo desarrollo SPA (Vite / Vitest): sin depender de `google.script.run`.
 * Staging/producción GAS: `vite build --mode gas` servido desde Web App.
 */
import { isLocalDevRuntime } from './runtimeProfile'

export function isLocalSpaDevMode(): boolean {
  return isLocalDevRuntime()
}

export function isGasScriptHostAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.google?.script?.run !== 'undefined'
}
