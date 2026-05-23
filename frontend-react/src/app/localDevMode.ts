/**
 * Modo desarrollo SPA (Vite / Vitest): sin depender de `google.script.run`.
 * Producción Apps Script: `import.meta.env.MODE === 'gas'`.
 */
export function isLocalSpaDevMode(): boolean {
  return import.meta.env.MODE !== 'gas'
}

export function isGasScriptHostAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.google?.script?.run !== 'undefined'
}
