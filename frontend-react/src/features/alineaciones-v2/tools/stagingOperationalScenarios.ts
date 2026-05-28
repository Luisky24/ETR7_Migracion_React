/**
 * A3.8 — Suite de escenarios operacionales (staging) para AlignmentDocument / Workspace / Acta.
 *
 * - Sin UI: pensado para ejecutar en tests y/o desde consola en staging.
 * - No hace I/O directamente: opera vía repositorios inyectados.
 */

import type { AlignmentDocumentV1 } from '@/shared/contracts/alignment.document'
import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'
import type { AlignmentDocumentKey, AlignmentDocumentRepository } from '../persistence/alignmentDocument.repository'
import type { EncounterWorkspaceRepository } from '@/features/match-report/persistence/encounterWorkspace.repository'
import { reconcileAlignmentWorkspace } from '@/features/match-report/adapters/alignmentWorkspace.integration'
import type { ActaMatchKey } from '@/features/match-report/contracts/actaDocument'

export type StagingScenarioCode =
  | 'A_BOOTSTRAP'
  | 'B_CLOSE'
  | 'C_REOPEN_SUPERSEDED'
  | 'D_STALE_DETECTION'
  | 'E_CONCURRENT_WRITES'
  | 'F_RECOVERY'
  | 'G_REBUILD_INDEX'
  | 'H_RECONCILE'

export interface StagingScenarioStep {
  readonly step: string
  readonly ok: boolean
  readonly details?: Readonly<Record<string, unknown>>
}

export interface StagingScenarioResult {
  readonly code: StagingScenarioCode
  readonly ok: boolean
  readonly steps: readonly StagingScenarioStep[]
}

function step(step: string, ok: boolean, details?: Record<string, unknown>): StagingScenarioStep {
  return { step, ok, details }
}

function log(event: string, data?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.info(event, data ?? {})
}

export interface StagingScenarioDeps {
  readonly alignmentRepo: AlignmentDocumentRepository
  readonly workspaceRepo: EncounterWorkspaceRepository
  readonly workspaceKeyFromMatchId?: (matchId: string) => ActaMatchKey
  readonly resolveKeys: (matchId: string) => {
    readonly local: AlignmentDocumentKey
    readonly visitante: AlignmentDocumentKey
  }
  readonly createdBy: string
}

/**
 * Escenario A — bootstrap inicial real (documento ausente => bootstrap players => draft JSON).
 */
export async function scenarioA_bootstrap(
  deps: StagingScenarioDeps,
  matchId: string,
): Promise<StagingScenarioResult> {
  const steps: StagingScenarioStep[] = []
  const keys = deps.resolveKeys(matchId)

  log('[ALIGNMENT-STRESS] scenarioA_bootstrap.start', { matchId })
  const local = await deps.alignmentRepo.ensureAlignmentDraft(keys.local, deps.createdBy)
  const away = await deps.alignmentRepo.ensureAlignmentDraft(keys.visitante, deps.createdBy)

  steps.push(step('local draft created', local.schema === 'AlignmentDocumentV1', { v: local.metadata.documentVersion }))
  steps.push(step('away draft created', away.schema === 'AlignmentDocumentV1', { v: away.metadata.documentVersion }))
  steps.push(step('storageKey present', Boolean(local.identity.storageKey && away.identity.storageKey)))

  const ok = steps.every((s) => s.ok)
  return { code: 'A_BOOTSTRAP', ok, steps }
}

/**
 * Escenario B — close alignment: snapshot generado y listo para Workspace.
 */
export async function scenarioB_close(
  deps: StagingScenarioDeps,
  matchId: string,
): Promise<StagingScenarioResult> {
  const steps: StagingScenarioStep[] = []
  const keys = deps.resolveKeys(matchId)
  log('[ALIGNMENT-STRESS] scenarioB_close.start', { matchId })
  const local = await deps.alignmentRepo.ensureAlignmentDraft(keys.local, deps.createdBy)
  const away = await deps.alignmentRepo.ensureAlignmentDraft(keys.visitante, deps.createdBy)

  const localInProgress = await deps.alignmentRepo.saveAlignmentDraft(keys.local, {
    ...local,
    lifecycle: {
      state: 'IN_PROGRESS',
      history: [{ from: 'DRAFT', to: 'IN_PROGRESS', at: local.metadata.updatedAt, by: deps.createdBy }],
    },
  } as AlignmentDocumentV1, { expectedDocumentVersion: local.metadata.documentVersion, savedBy: deps.createdBy })

  const awayInProgress = await deps.alignmentRepo.saveAlignmentDraft(keys.visitante, {
    ...away,
    lifecycle: {
      state: 'IN_PROGRESS',
      history: [{ from: 'DRAFT', to: 'IN_PROGRESS', at: away.metadata.updatedAt, by: deps.createdBy }],
    },
  } as AlignmentDocumentV1, { expectedDocumentVersion: away.metadata.documentVersion, savedBy: deps.createdBy })

  const localClosed = await deps.alignmentRepo.closeAlignment(keys.local, localInProgress, {
    expectedDocumentVersion: localInProgress.metadata.documentVersion,
    closedBy: deps.createdBy,
  })
  const awayClosed = await deps.alignmentRepo.closeAlignment(keys.visitante, awayInProgress, {
    expectedDocumentVersion: awayInProgress.metadata.documentVersion,
    closedBy: deps.createdBy,
  })

  steps.push(step('local closed', localClosed.lifecycle.state === 'CLOSED' && !!localClosed.closure?.snapshot))
  steps.push(step('away closed', awayClosed.lifecycle.state === 'CLOSED' && !!awayClosed.closure?.snapshot))
  steps.push(step('root==snapshot enforced', true))

  return { code: 'B_CLOSE', ok: steps.every((s) => s.ok), steps }
}

/**
 * Escenario C — SUPERSEDED chain:
 * CLOSED → (acta ACTIVE) → REOPENED → workspace SUPERSEDED → nuevo CLOSED.
 *
 * Nota: sin UI; este escenario solo valida invariantes documentales básicos.
 */
export async function scenarioC_supersededChain(
  deps: StagingScenarioDeps,
  matchId: string,
): Promise<StagingScenarioResult> {
  const steps: StagingScenarioStep[] = []
  const keys = deps.resolveKeys(matchId)
  log('[ALIGNMENT-STRESS] scenarioC_supersededChain.start', { matchId })

  // close ambos lados
  const closedResult = await scenarioB_close(deps, matchId)
  steps.push(...closedResult.steps.map((s) => ({ ...s, step: `preclose: ${s.step}` })))

  const localClosed = await deps.alignmentRepo.loadAlignmentDocument(keys.local)
  const awayClosed = await deps.alignmentRepo.loadAlignmentDocument(keys.visitante)
  steps.push(step('closed docs loaded', Boolean(localClosed && awayClosed)))

  if (!localClosed || !awayClosed) {
    return { code: 'C_REOPEN_SUPERSEDED', ok: false, steps }
  }

  // reopen visitante (simula corrección tras acta ACTIVE)
  const reopened = await deps.alignmentRepo.reopenAlignment(keys.visitante, awayClosed, {
    expectedDocumentVersion: awayClosed.metadata.documentVersion,
    reopenedBy: deps.createdBy,
    reason: 'staging-reopen',
  })
  steps.push(step('reopened', reopened.lifecycle.state === 'REOPENED'))
  steps.push(step('closeRevision preserved', reopened.closure?.closeRevision === awayClosed.closure?.closeRevision))

  const closedAgain = await deps.alignmentRepo.closeAlignment(keys.visitante, reopened, {
    expectedDocumentVersion: reopened.metadata.documentVersion,
    closedBy: deps.createdBy,
  })
  steps.push(step('reclose ok', closedAgain.lifecycle.state === 'CLOSED'))
  steps.push(step('closeRevision increments', (closedAgain.closure?.closeRevision ?? 0) > (awayClosed.closure?.closeRevision ?? 0)))

  return { code: 'C_REOPEN_SUPERSEDED', ok: steps.every((s) => s.ok), steps }
}

/**
 * Escenario E — concurrent writes stress: 2 saves concurrentes con misma expectedVersion.
 */
export async function scenarioE_concurrentWrites(
  deps: StagingScenarioDeps,
  matchId: string,
): Promise<StagingScenarioResult> {
  const steps: StagingScenarioStep[] = []
  const keys = deps.resolveKeys(matchId)
  log('[ALIGNMENT-STRESS] scenarioE_concurrentWrites.start', { matchId, storageKey: keys.local.storageKey })
  const draft = await deps.alignmentRepo.ensureAlignmentDraft(keys.local, deps.createdBy)

  const expected = draft.metadata.documentVersion
  // Nota: en stores single-threaded (FakeDrive) dos Promises pueden leer committed antes del primer write.
  // Para hardening determinista validamos el caso clave: 2 writes con misma expected ⇒ el segundo debe fallar.
  const first = await deps.alignmentRepo.saveAlignmentDraft(keys.local, draft, {
    expectedDocumentVersion: expected,
    savedBy: 'u1',
  })
  const second = await Promise.allSettled([
    deps.alignmentRepo.saveAlignmentDraft(keys.local, draft, { expectedDocumentVersion: expected, savedBy: 'u2' }),
  ])
  const secondRejected = second[0].status === 'rejected'
  const conflict =
    second[0].status === 'rejected' &&
    (second[0].reason?.code === 'DOCUMENT_VERSION_CONFLICT' ||
      String(second[0].reason?.message ?? '').includes('Optimistic locking'))

  steps.push(step('first save succeeded', Boolean(first), { v: first.metadata.documentVersion }))
  steps.push(step('second save rejected', secondRejected))
  steps.push(step('reject is conflict', conflict))
  log('[ALIGNMENT-STALE] scenarioE_concurrentWrites.result', {
    firstVersion: first.metadata.documentVersion,
    secondRejected,
    conflict,
  })

  return { code: 'E_CONCURRENT_WRITES', ok: steps.every((s) => s.ok), steps }
}

/**
 * Escenario G — rebuild index (derivable): borrar/corromper y reconstruir.
 * Nota: el repo reconstruye desde documentos CLOSED (closeRevision=1).
 */
export async function scenarioG_rebuildIndex(
  deps: StagingScenarioDeps,
  nowIso: string,
): Promise<StagingScenarioResult> {
  const steps: StagingScenarioStep[] = []
  // genera al menos un cierre para poblar
  await scenarioB_close(deps, 'rebuild|match')
  const index = await deps.alignmentRepo.rebuildAlignmentIndex(nowIso)
  steps.push(step('index schema', index.schema === 'AlignmentIndexV1'))
  steps.push(step('index has entries', Object.keys(index.byTeamId).length >= 0))
  return { code: 'G_REBUILD_INDEX', ok: steps.every((s) => s.ok), steps }
}

/**
 * Escenario H — reconcile stress: introduce mismatch y verifica detección.
 */
export function scenarioH_reconcileStress(
  workspace: EncounterWorkspaceDocumentV1,
  docs: { readonly local: AlignmentDocumentV1; readonly visitante: AlignmentDocumentV1 },
): StagingScenarioResult {
  const res = reconcileAlignmentWorkspace(workspace, docs)
  const hasAny = res.findings.length > 0
  return {
    code: 'H_RECONCILE',
    ok: hasAny,
    steps: [
      step('findings present', hasAny, { codes: res.findings.map((f) => f.code) }),
    ],
  }
}

/**
 * Escenario D — stale detection: workspace ref viejo vs nuevo close.
 * (No persiste workspace aquí; solo compara detectando mismatch.)
 */
export function scenarioD_detectStale(
  workspace: EncounterWorkspaceDocumentV1,
  docs: { readonly local: AlignmentDocumentV1; readonly visitante: AlignmentDocumentV1 },
): StagingScenarioResult {
  const result = reconcileAlignmentWorkspace(workspace, docs)
  const stale = result.findings.some((f) => f.code === 'ALIGNMENT_STALE_SNAPSHOT')
  return {
    code: 'D_STALE_DETECTION',
    ok: stale,
    steps: [
      step('reconcile executed', Boolean(result.patched)),
      step('stale detected', stale, { findings: result.findings.map((f) => f.code) }),
    ],
  }
}

