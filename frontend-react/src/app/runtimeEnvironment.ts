/**
 * Auditoría de entorno en arranque (staging / GAS / persistencia JSON).
 * Solo logs y warnings — sin throw fatal.
 */

import { isLocalSpaDevMode, isGasScriptHostAvailable } from '@/app/localDevMode'
import {
  getDocumentStoreKind,
  getGasTransportKind,
  getRuntimeProfile,
  isStagingGasRuntime,
  logRuntimeProfileStartup,
  type DocumentStoreKind,
  type RuntimeProfile,
} from '@/app/runtimeProfile'
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
  | 'STAGING_OPENED_OUTSIDE_GAS_HOST'

export interface RuntimeEnvironmentIssue {
  readonly code: RuntimeEnvironmentIssueCode
  readonly severity: 'warning' | 'info'
  readonly message: string
}

export interface RuntimeEnvironmentSnapshot {
  readonly profile: RuntimeProfile
  readonly viteMode: string
  readonly persistence: ActaPersistenceMode
  readonly matchReportService: 'mock' | 'gas'
  readonly gasTransport: 'mock' | 'real'
  readonly documentStore: DocumentStoreKind
  readonly actaRepository: 'Drive/GAS' | 'mock/local'
  readonly calendarSync: 'real' | 'mock/local'
  readonly googleScriptRunPresent: boolean
  readonly stagingBanner: boolean
  readonly localDevJsonWarning: boolean
}

function isNonProductionStagingContext(): boolean {
  return isStagingGasRuntime() || import.meta.env.DEV
}

/** Banner staging: Web App GAS + JSON/hybrid + flag staging. */
export function shouldShowStagingEnvironmentBanner(): boolean {
  if (!isStagingGasRuntime()) return false
  if (!usesJsonPersistence()) return false
  return isNonProductionStagingContext()
}

/** Aviso local-dev: JSON/hybrid con transporte mock (`npm run dev`). */
export function shouldShowLocalDevJsonWarning(): boolean {
  if (!isLocalSpaDevMode()) return false
  return usesJsonPersistence()
}

export function getRuntimeEnvironmentSnapshot(): RuntimeEnvironmentSnapshot {
  const localDev = isLocalSpaDevMode()
  const persistence = getActaPersistenceMode()
  const jsonPersistence = usesJsonPersistence(persistence)
  const store = getDocumentStoreKind()

  return {
    profile: getRuntimeProfile(),
    viteMode: import.meta.env.MODE,
    persistence,
    matchReportService: getMatchReportServiceMode(),
    gasTransport: getGasTransportKind(),
    documentStore: store,
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
        'JSON persistence en LOCAL DEV (fakeDrive). Para staging GAS real: npm run staging:gas y abrir la Web App Apps Script.',
    })
  }

  if (!localDev && !snapshot.googleScriptRunPresent) {
    issues.push({
      code: 'MISSING_GOOGLE_SCRIPT_RUN',
      severity: 'warning',
      message:
        'google.script.run no detectado — abrir la SPA desde la Web App Apps Script (no localhost ni vite preview).',
    })
  }

  if (isStagingGasRuntime() && !snapshot.googleScriptRunPresent) {
    issues.push({
      code: 'STAGING_OPENED_OUTSIDE_GAS_HOST',
      severity: 'warning',
      message:
        'Build staging-gas abierto fuera del host GAS — Encounter Workspace requiere google.script.run.',
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
        'Build GAS con persistencia legacy — no se ejercita Encounter Workspace hasta VITE_ETR7_ACTA_PERSISTENCE=hybrid|json.',
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
  logRuntimeProfileStartup()

  const s = getRuntimeEnvironmentSnapshot()
  const lines: Record<string, string> = {
    Profile: s.profile,
    MODE: s.viteMode,
    Persistence: s.persistence,
    MatchReportService: s.matchReportService,
    GasTransport: s.gasTransport,
    DocumentStore: s.documentStore,
    ActaRepository: s.actaRepository,
    CalendarSync: s.calendarSync,
    GoogleScriptRun: s.googleScriptRunPresent ? 'present' : 'missing',
    StagingBanner: s.stagingBanner ? 'on' : 'off',
  }

  log.debug(`${RUNTIME_LOG} startup`, lines)

  if (s.profile === 'staging-gas') {
    // eslint-disable-next-line no-console -- arranque staging: siempre visible en consola Web App
    console.info(
      `${RUNTIME_LOG} staging-gas Persistence=${s.persistence} Store=${s.documentStore} Transport=real`,
    )
    // eslint-disable-next-line no-console
    console.info(
      '[STAGING-RUNTIME] startup WebApp documental — use window.__ETR7_DOC__ y RUNTIME_DOCUMENTAL_STAGING_CHECKLIST.md',
    )
  }

  if (s.profile === 'production') {
    // eslint-disable-next-line no-console
    console.info(
      `${RUNTIME_LOG} production Persistence=${s.persistence} Store=${s.documentStore} Transport=real`,
    )
  }
}
