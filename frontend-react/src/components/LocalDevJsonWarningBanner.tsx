import { shouldShowLocalDevJsonWarning } from '@/app/runtimeEnvironment'
import { getActaPersistenceMode } from '@/features/match-report/config/persistenceFlags'

/**
 * Aviso visible en `npm run dev` con persistencia JSON/hybrid (transporte mock).
 */
export function LocalDevJsonWarningBanner() {
  if (!shouldShowLocalDevJsonWarning()) {
    return null
  }

  const persistence = getActaPersistenceMode()

  return (
    <div
      className="sticky top-0 z-[99] border-b-2 border-rose-600 bg-rose-50 px-3 py-2 text-center text-sm font-semibold text-rose-950"
      role="alert"
      data-testid="local-dev-json-warning-banner"
    >
      JSON persistence running in LOCAL DEV MOCK MODE ({persistence}) — no usar para staging
      federativo. Ejecutar{' '}
      <code className="rounded bg-rose-100 px-1 text-xs">npm run build:gas</code> y Web App GAS.
    </div>
  )
}
