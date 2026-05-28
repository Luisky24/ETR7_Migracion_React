/**
 * Perfil operativo de la SPA (localDev vs staging GAS vs producción GAS).
 * Una sola fuente de verdad para transport, store y login.
 */

export type RuntimeProfile = 'localDev' | 'staging-gas' | 'production'

export type DocumentStoreKind = 'fakeDrive' | 'gasDrive'

export type GasTransportKind = 'mock' | 'real'

function isStagingFlagEnabled(): boolean {
  const v = import.meta.env.VITE_ETR7_STAGING
  return v === 'true' || v === '1'
}

/** `true` cuando la SPA corre con `vite --mode gas` (Web App Apps Script). */
export function isGasSpaBuild(): boolean {
  return import.meta.env.MODE === 'gas'
}

/**
 * Desarrollo rápido: `npm run dev` (Vite MODE !== gas).
 * Transport mock + fakeDrive vía mockGasHandlers.
 */
export function isLocalDevRuntime(): boolean {
  return !isGasSpaBuild()
}

/** Staging federativo: build gas + `VITE_ETR7_STAGING` + Web App GAS. */
export function isStagingGasRuntime(): boolean {
  return isGasSpaBuild() && isStagingFlagEnabled()
}

/** Producción GAS estable: build gas sin flag staging. */
export function isProductionGasRuntime(): boolean {
  return isGasSpaBuild() && !isStagingFlagEnabled()
}

export function getRuntimeProfile(): RuntimeProfile {
  if (isLocalDevRuntime()) return 'localDev'
  if (isStagingGasRuntime()) return 'staging-gas'
  return 'production'
}

export function getGasTransportKind(): GasTransportKind {
  return isLocalDevRuntime() ? 'mock' : 'real'
}

export function getDocumentStoreKind(): DocumentStoreKind {
  return isLocalDevRuntime() ? 'fakeDrive' : 'gasDrive'
}

/** Logs de arranque visibles en consola Web App / devtools. */
export function logRuntimeProfileStartup(): void {
  const profile = getRuntimeProfile()
  const store = getDocumentStoreKind()
  const transport = getGasTransportKind()

  // eslint-disable-next-line no-console -- diagnóstico operativo obligatorio en staging
  console.info(`[ENV] ${profile}`)
  // eslint-disable-next-line no-console
  console.info(`[STORE] ${store}`)
  // eslint-disable-next-line no-console
  console.info(`[TRANSPORT] ${transport === 'real' ? 'gas' : 'mock'}`)
}
