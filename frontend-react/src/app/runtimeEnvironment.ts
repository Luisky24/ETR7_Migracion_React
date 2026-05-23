/**
 * Auditoría de entorno en arranque (staging / GAS / persistencia JSON).
 * Solo logs y warnings — sin throw fatal.
 */

import { isLocalSpaDevMode, isGasScriptHostAvailable } from '@/app/localDevMode'
import { log } from '@/core/debug'
import {
  getActaPersistenceMode,
  usesJsonPersistence,
  type ActaPersistenceMode,
} from '@/features/match-report/config/persistenceFlags'
import { getMatchReportServiceMode } from '@/features/match-report/services/matchReport.service'
import { isQaRuntimeSimulationEnabled } from '@/features/match-report/utils/qaRuntimeSimulation'

const RUNTIME_LOG = '[ETR7 Runtime]'

export type RuntimeEnvironmentIssueCode =
  | 'LOCAL_DEV_WITH_JSON_PERSISTENCE'
  | 'MISSING_GOOGLE_SCRIPT_RUN'
  | 'MATCH_REPORT_MOCK_MODE'
  | 'LEGACY_PERSISTENCE_ON_GAS_BUILD'
  | 'QA_FLAGS_ACTIVE'

export interface RuntimeEnvironmentIssue {
  readonly code: RuntimeEnvironmentIssueCode
  readonly severity: 'warning' | 'info'
  readonly message: string
}

export interface RuntimeEnvironmentSnapshot {
  readonly viteMode: string
  readonly persistence: ActaPersistenceMode
  readonly matchReportService: 'mock' | 'gas'
  readonly gasTransport: 'mock' | 'real'
  readonly actaRepository: 'Drive/GAS' | 'mock/local'
  readonly calendarSync: 'real' | 'mock/local'
  readonly googleScriptRunPresent: boolean
  readonly stagingBanner: boolean
  readonly localDevJsonWarning: boolean
}

function isStagingBuildFlag(): boolean {
  const v = import.meta.env.VITE_ETR7_STAGING
  return v === 'true' || v === '1'
}

function isNonProductionStagingContext(): boolean {
  return isStagingBuildFlag() || import.meta.env.DEV
}

/** Banner staging: Web App GAS + JSON/hybrid + entorno no producción estable. */
export function shouldShowStagingEnvironmentBanner(): boolean {
  if (import.meta.env.MODE !== 'gas') return false
  if (!usesJsonPersistence()) return false
  return isNonProductionStagingContext()
}

/** Aviso local-dev: JSON/hybrid con transporte mock (npm run dev). */
export function shouldShowLocalDevJsonWarning(): boolean {
  if (!isLocalSpaDevMode()) return false
  return usesJsonPersistence()
}

export function getRuntimeEnvironmentSnapshot(): RuntimeEnvironmentSnapshot {
  const localDev = isLocalSpaDevMode()
  const persistence = getActaPersistenceMode()
  const jsonPersistence = usesJsonPersistence(persistence)

  return {
    viteMode: import.meta.env.MODE,
    persistence,
    matchReportService: getMatchReportServiceMode(),
    gasTransport: localDev ? 'mock' : 'real',
    actaRepository: localDev && jsonPersistence ? 'mock/local' : 'Drive/GAS',
    calendarSync: localDev ? 'mock/local' : 'real',
    googleScriptRunPresent: isGasScriptHostAvailable(),
    stagingBanner: shouldShowStagingEnvironmentBanner(),
    localDevJsonWarning: shouldShowLocalDevJsonWarning(),
  }
}

/**
 * Detecta configuración de riesgo para staging real. Emite `log.warn`; no lanza.
 */
export function assertRuntimeEnvironment(): readonly RuntimeEnvironmentIssue[] {
  const issues: RuntimeEnvironmentIssue[] = []
  const snapshot = getRuntimeEnvironmentSnapshot()
  const localDev = isLocalSpaDevMode()
  const jsonPersistence = usesJsonPersistence()

  if (localDev && jsonPersistence) {
    issues.push({
      code: 'LOCAL_DEV_WITH_JSON_PERSISTENCE',
      severity: 'warning',
      message:
        'JSON persistence running in LOCAL DEV MOCK MODE — use npm run build:gas and Web App GAS for federative staging.',
    })
  }

  if (!localDev && !snapshot.googleScriptRunPresent) {
    issues.push({
      code: 'MISSING_GOOGLE_SCRIPT_RUN',
      severity: 'warning',
      message:
        'google.script.run no detectado — abrir la SPA desde la Web App Apps Script, no localhost/preview.',
    })
  }

  if (snapshot.matchReportService === 'mock' && import.meta.env.MODE === 'gas') {
    issues.push({
      code: 'MATCH_REPORT_MOCK_MODE',
      severity: 'warning',
      message: 'Match report service en modo mock con build MODE=gas (configuración inconsistente).',
    })
  }

  if (import.meta.env.MODE === 'gas' && !jsonPersistence) {
    issues.push({
      code: 'LEGACY_PERSISTENCE_ON_GAS_BUILD',
      severity: 'info',
      message:
        'Build GAS con persistencia legacy — no se ejercita JSON/hybrid hasta VITE_ETR7_ACTA_PERSISTENCE=hybrid|json.',
    })
  }

  if (isQaRuntimeSimulationEnabled()) {
    issues.push({
      code: 'QA_FLAGS_ACTIVE',
      severity: 'warning',
      message: 'Flags QA (__ETR7_QA__) activas — pueden simular fallos de carga/guardado/cierre.',
    })
  }

  for (const issue of issues) {
    log.warn(`${RUNTIME_LOG} assert.${issue.code}`, { message: issue.message })
  }

  return issues
}

/** Log único de arranque con capacidades reales esperadas. */
export function logRuntimeStartup(): void {
  const s = getRuntimeEnvironmentSnapshot()
  const lines: Record<string, string> = {
    MODE: s.viteMode,
    Persistence: s.persistence,
    MatchReportService: s.matchReportService,
    GasTransport: s.gasTransport,
    ActaRepository: s.actaRepository,
    CalendarSync: s.calendarSync,
    GoogleScriptRun: s.googleScriptRunPresent ? 'present' : 'missing',
    StagingBanner: s.stagingBanner ? 'on' : 'off',
  }

  log.debug(`${RUNTIME_LOG} startup`, lines)

  if (import.meta.env.MODE === 'gas' && usesJsonPersistence()) {
    // eslint-disable-next-line no-console -- arranque staging: siempre visible en consola Web App
    console.info(
      `${RUNTIME_LOG} MODE=gas Persistence=${s.persistence} CalendarSync=real ActaRepository=Drive`,
    )
  }
}
