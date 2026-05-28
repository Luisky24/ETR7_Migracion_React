import { shouldShowStagingEnvironmentBanner } from '@/app/runtimeEnvironment'
import { getActaPersistenceMode } from '@/features/match-report/config/persistenceFlags'

/**
 * Indicador visual persistente: staging JSON/hybrid en Web App GAS (no producción).
 */
export function StagingEnvironmentBanner() {
  if (!shouldShowStagingEnvironmentBanner()) {
    return null
  }

  const mode = getActaPersistenceMode().toUpperCase()

  return (
    <div
      className="sticky top-0 z-[100] border-b-2 border-amber-500 bg-amber-100 px-3 py-2 text-center text-sm font-semibold text-amber-950 shadow-sm"
      role="status"
      aria-live="polite"
      data-testid="staging-environment-banner"
    >
      <span className="block">ETR7 STAGING GAS — JSON/{mode}</span>
      <span className="block text-xs font-normal">
        Transporte GAS + Drive + Encounter Workspace REAL · NO PRODUCCIÓN
      </span>
    </div>
  )
}
