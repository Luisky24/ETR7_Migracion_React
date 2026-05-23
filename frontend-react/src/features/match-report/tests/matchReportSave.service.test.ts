import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActaDocumentV1 } from '../contracts/actaDocument'
import { hydrateMatchReportFromActaDocument } from '../adapters/actaHydration.adapter'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import { parseActaPersistenceMode, usesJsonPersistence } from '../config/persistenceFlags'
import { createFakeDriveJsonPersistenceRepository } from '../infra/jsonPersistence.adapter'
import { keyFromDocument } from '../persistence/actaRepositoryKeys'
import { recalculateMatchReport } from '../domain/scoring'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import { buildMatchPersistenceDto } from '../utils/persistenceDto'
import { normalizePersistenceSaveError } from '../utils/persistenceSaveErrors'
import { resolveRecoveryPolicy } from '../utils/recoveryPolicy'
import {
  clearActaPersistenceSession,
  getActaPersistenceSession,
  setActaPersistenceSession,
  syncActaPersistenceSessionFromBootstrap,
} from '../services/actaPersistenceSession'
import { closeActaJson, saveActaDraftJson } from '../services/actaPersistence.service'
import {
  closeMatchReportForRuntimeSafe,
  saveMatchReportDraftForRuntimeSafe,
} from '../services/matchReportSave.service'
import { isServiceSuccess } from '../contracts/service-result.contract'
import { baseContext, emptyMatchReport, playerLine } from './fixtures'

function reportWithScore() {
  const context = baseContext()
  let report = emptyMatchReport(context)
  report = {
    ...report,
    local: {
      ...report.local,
      players: [playerLine('A', 1, { E: 1 }, { titular: true }), ...report.local.players.slice(1)],
    },
  }
  return recalculateMatchReport(report)
}

function seedSessionFromReport(report: ReturnType<typeof reportWithScore>, version = 0) {
  const encounterNumber = 14
  setActaPersistenceSession(report.context.encuentroId, {
    documentName: buildActaDocumentName(report.context.phase, encounterNumber),
    encounterNumber,
    documentVersion: version,
  })
}

describe('persistenceFlags save', () => {
  it('usesJsonPersistence para json y hybrid', () => {
    expect(usesJsonPersistence('json')).toBe(true)
    expect(usesJsonPersistence('hybrid')).toBe(true)
    expect(usesJsonPersistence('legacy')).toBe(false)
    expect(parseActaPersistenceMode('json')).toBe('json')
  })
})

describe('matchReportSave JSON', () => {
  beforeEach(() => {
    clearActaPersistenceSession()
  })

  afterEach(() => {
    clearActaPersistenceSession()
    vi.restoreAllMocks()
  })

  it('1. save draft JSON — NO_EXISTE → ACTA_EN_CURSO y documentVersion 1', async () => {
    const report = reportWithScore()
    seedSessionFromReport(report, 0)
    const repoBundle = createFakeDriveJsonPersistenceRepository()
    const repo = repoBundle

    const result = await saveActaDraftJson(report, { repository: repo })
    expect(isServiceSuccess(result)).toBe(true)
    if (!isServiceSuccess(result)) return

    const session = getActaPersistenceSession(report.context.encuentroId)
    expect(session?.documentVersion).toBe(1)

    const key = keyFromDocument(
      projectMatchReportToActaDocument({
        metadata: {
          schemaVersion: 1,
          documentVersion: 1,
          status: 'ACTA_EN_CURSO',
          createdAt: '',
          updatedAt: '',
        },
        report,
        encounterNumber: 14,
        documentName: buildActaDocumentName('Fase I', 14),
      }),
    )
    expect(await repo.resolveLifecycle(key)).toBe('ACTA_EN_CURSO')
    expect(repoBundle.driveStore.getFiles().size).toBeGreaterThan(0)
  })

  it('2. close JSON — ACTA_EN_CURSO → ACTA_CERRADA', async () => {
    const report = reportWithScore()
    seedSessionFromReport(report, 0)
    const repoBundle = createFakeDriveJsonPersistenceRepository()
    const repo = repoBundle

    await saveActaDraftJson(report, { repository: repo })
    const session = getActaPersistenceSession(report.context.encuentroId)!
    const closedReport = { ...report, cerrada: true, editability: 'read_only' as const }

    const result = await closeActaJson(closedReport, { repository: repo })
    expect(isServiceSuccess(result)).toBe(true)
    if (!isServiceSuccess(result)) return
    expect(result.data.ok).toBe(true)
    expect(result.data.cerrada).toBe(true)

    const key = {
      category: report.context.category,
      phase: report.context.phase,
      matchId: report.context.encuentroId,
    }
    expect(await repo.resolveLifecycle(key)).toBe('ACTA_CERRADA')
    expect(getActaPersistenceSession(report.context.encuentroId)?.documentVersion).toBe(2)
  })

  it('3. LOCK_REPORT tras close en reducer', () => {
    const report = reportWithScore()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: { report, cerrada: false, fromActaSnapshot: false } },
    })
    state = matchReportReducer(state, {
      type: 'FINALIZE_REPORT_SUCCESS',
      payload: {
        result: { ok: true, cerrada: true },
        report: { ...report, cerrada: true, editability: 'read_only' },
      },
    })
    state = matchReportReducer(state, { type: 'LOCK_REPORT' })
    expect(state.operation).toBe('locked')
    expect(state.report?.editability).toBe('read_only')
  })

  it('4. documentVersion propagation en sesión tras save y update', async () => {
    const report = reportWithScore()
    seedSessionFromReport(report, 0)
    const repo = createFakeDriveJsonPersistenceRepository()

    await saveActaDraftJson(report, { repository: repo })
    expect(getActaPersistenceSession(report.context.encuentroId)?.documentVersion).toBe(1)

    const updated = recalculateMatchReport({
      ...report,
      score: { local: 10, visitante: 0 },
    })
    const second = await saveActaDraftJson(updated, { repository: repo })
    expect(isServiceSuccess(second)).toBe(true)
    expect(getActaPersistenceSession(report.context.encuentroId)?.documentVersion).toBe(2)
  })

  it('5. version conflict — recovery shouldReload', async () => {
    const report = reportWithScore()
    seedSessionFromReport(report, 0)
    const repo = createFakeDriveJsonPersistenceRepository()
    await saveActaDraftJson(report, { repository: repo })

    const session = getActaPersistenceSession(report.context.encuentroId)!
    setActaPersistenceSession(report.context.encuentroId, {
      ...session,
      documentVersion: 99,
    })

    const conflict = await saveActaDraftJson(report, { repository: repo })
    expect(conflict.kind).toBe('recoverableError')
    if (conflict.kind !== 'recoverableError') return

    const err = conflict.error
    expect(err.code).toBe('DOCUMENT_VERSION_CONFLICT')
    expect(err.shouldReload).toBe(true)

    const { hints } = resolveRecoveryPolicy('saved', err, true, true)
    expect(hints.canReload).toBe(true)
  })

  it('6. corruption path — CORRUPT_DOCUMENT bloquea', async () => {
    const report = reportWithScore()
    seedSessionFromReport(report, 0)
    const repoBundle = createFakeDriveJsonPersistenceRepository()
    await saveActaDraftJson(report, { repository: repoBundle })

    const key = {
      category: report.context.category,
      phase: report.context.phase,
      matchId: report.context.encuentroId,
    }
    const loaded = (await repoBundle.load(key))!
    repoBundle.driveStore.injectRawDocument(key, {
      ...loaded,
      match: { ...loaded.match, matchId: 'corrupt-other-id' },
    })

    clearActaPersistenceSession(report.context.encuentroId)

    const result = await saveActaDraftJson(report, { repository: repoBundle })
    expect(result.kind).toBe('fatalError')
    if (result.kind !== 'fatalError') return
    expect(result.error.shouldBlock).toBe(true)
  })

  it('7. classification freeze tras close — hydrate no recalcula', async () => {
    const report = reportWithScore()
    seedSessionFromReport(report, 0)
    const repo = createFakeDriveJsonPersistenceRepository()
    await saveActaDraftJson(report, { repository: repo })

    const frozenClass = { P: 99, BO: 0, BD: 0, Total: 99 }
    const toClose = {
      ...report,
      local: { ...report.local, classification: frozenClass },
      cerrada: true,
      editability: 'read_only' as const,
    }
    await closeActaJson(toClose, { repository: repo })

    const key = {
      category: report.context.category,
      phase: report.context.phase,
      matchId: report.context.encuentroId,
    }
    const doc = (await repo.load(key))!
    expect(doc.classification.local.P).toBe(99)
    expect(doc.metadata.status).toBe('ACTA_CERRADA')

    const hydrated = hydrateMatchReportFromActaDocument(doc, { context: baseContext() })
    expect(hydrated.local.classification.P).toBe(99)
    expect(hydrated.cerrada).toBe(true)
  })

  it('8. ACTA_CERRADA readonly hydrate', async () => {
    const report = reportWithScore()
    seedSessionFromReport(report, 0)
    const repo = createFakeDriveJsonPersistenceRepository()
    await saveActaDraftJson(report, { repository: repo })
    await closeActaJson(
      { ...report, cerrada: true, editability: 'read_only' },
      { repository: repo },
    )

    const key = {
      category: report.context.category,
      phase: report.context.phase,
      matchId: report.context.encuentroId,
    }
    const doc = (await repo.load(key))!
    const hydrated = hydrateMatchReportFromActaDocument(doc)
    expect(hydrated.editability).toBe('read_only')
    expect(hydrated.cerrada).toBe(true)
    expect(hydrated.context.matchStatus).toBe('acta_cerrada')
  })
})

describe('matchReportSave feature flags', () => {
  afterEach(() => {
    clearActaPersistenceSession()
    vi.restoreAllMocks()
  })

  it('9. featureFlag legacy save delega en saveLegacy', async () => {
    const report = reportWithScore()
    const dto = buildMatchPersistenceDto(report, false)
    const saveLegacy = vi.fn(async () => ({ ok: true as const, report }))

    const result = await saveMatchReportDraftForRuntimeSafe(dto, report, {
      getPersistenceMode: () => 'legacy',
      saveLegacy,
    })

    expect(saveLegacy).toHaveBeenCalledOnce()
    expect(isServiceSuccess(result)).toBe(true)
  })

  it('10. featureFlag json save usa repositorio JSON', async () => {
    const report = reportWithScore()
    seedSessionFromReport(report, 0)
    const dto = buildMatchPersistenceDto(report, false)
    const saveLegacy = vi.fn()

    const repo = createFakeDriveJsonPersistenceRepository()
    const result = await saveMatchReportDraftForRuntimeSafe(dto, report, {
      getPersistenceMode: () => 'json',
      repository: repo,
      saveLegacy,
    })

    expect(saveLegacy).not.toHaveBeenCalled()
    expect(isServiceSuccess(result)).toBe(true)
  })

  it('11. featureFlag hybrid save usa JSON', async () => {
    const report = reportWithScore()
    seedSessionFromReport(report, 0)
    const dto = buildMatchPersistenceDto(report, false)
    const repo = createFakeDriveJsonPersistenceRepository()

    const result = await saveMatchReportDraftForRuntimeSafe(dto, report, {
      getPersistenceMode: () => 'hybrid',
      repository: repo,
    })
    expect(isServiceSuccess(result)).toBe(true)
  })

  it('12. no regression reducers — UPDATE_ACTIONS recalcula', () => {
    const report = reportWithScore()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: { report, cerrada: false, fromActaSnapshot: false } },
    })
    const playerId = state.report!.local.players[0]!.playerId
    state = matchReportReducer(state, {
      type: 'UPDATE_ACTIONS',
      payload: { side: 'local', playerId, patch: { T: 1 } },
    })
    expect(state.dirty).toBe(true)
    expect(state.report!.score.local).toBeGreaterThan(0)
  })
})

describe('syncActaPersistenceSessionFromBootstrap', () => {
  afterEach(() => clearActaPersistenceSession())

  it('sincroniza versión desde documento JSON', () => {
    const report = reportWithScore()
    const doc = projectMatchReportToActaDocument({
      metadata: {
        schemaVersion: 1,
        documentVersion: 5,
        status: 'ACTA_EN_CURSO',
        createdAt: 't',
        updatedAt: 't',
      },
      report,
      encounterNumber: 3,
      documentName: buildActaDocumentName('Fase I', 3),
    })
    syncActaPersistenceSessionFromBootstrap({
      source: 'workspace_acta',
      lifecycle: 'ACTA_EN_CURSO',
      report,
      document: doc,
      workspaceVersion: 5,
      workspace: {
        identity: {
          matchId: report.context.encuentroId,
          documentFileName: doc.match.documentName,
          encounter: { encounterNumber: 3 },
        },
        metadata: { workspaceVersion: 5 },
      } as never,
    })
    expect(getActaPersistenceSession(report.context.encuentroId)?.documentVersion).toBe(5)
  })
})

describe('normalizePersistenceSaveError', () => {
  it('mapea DOCUMENT_VERSION_CONFLICT', () => {
    const err = normalizePersistenceSaveError({
      ok: false,
      code: 'DOCUMENT_VERSION_CONFLICT',
      message: 'conflict',
    })
    expect(err.code).toBe('DOCUMENT_VERSION_CONFLICT')
    expect(err.shouldReload).toBe(true)
  })
})

describe('closeMatchReportForRuntimeSafe legacy', () => {
  it('legacy close delega', async () => {
    const report = reportWithScore()
    const dto = buildMatchPersistenceDto(report, true)
    const closeLegacy = vi.fn(async () => ({ ok: true as const, cerrada: true }))

    const result = await closeMatchReportForRuntimeSafe(dto, report, {
      getPersistenceMode: () => 'legacy',
      closeLegacy,
    })
    expect(closeLegacy).toHaveBeenCalledOnce()
    expect(isServiceSuccess(result)).toBe(true)
  })
})
