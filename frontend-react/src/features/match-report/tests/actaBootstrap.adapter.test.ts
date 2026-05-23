import { describe, expect, it, vi } from 'vitest'
import * as hydrationAdapter from '../adapters/actaHydration.adapter'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import type { ActaDocumentMetadata } from '../contracts'
import { EncounterWorkspaceLoadError } from '../infra/encounterWorkspaceLoad.errors'
import { createActaBootstrapAdapter } from '../infra/actaBootstrap.adapter'
import { matchKeyFromContext } from '../persistence/matchKey'
import { createFakeDriveJsonPersistenceRepository } from '../infra/jsonPersistence.adapter'
import { EncounterWorkspaceRepository } from '../persistence/encounterWorkspace.repository'
import { baseContext, emptyMatchReport } from './fixtures'
import { legacyActaDocumentToWorkspace } from '../adapters/workspaceActa.mapper'

function baseMetadata(overrides: Partial<ActaDocumentMetadata> = {}): ActaDocumentMetadata {
  const now = '2026-05-21T12:00:00.000Z'
  return {
    schemaVersion: 1,
    documentVersion: 1,
    status: 'ACTA_EN_CURSO',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function workspaceLoader(repo: ReturnType<typeof createFakeDriveJsonPersistenceRepository>) {
  return createActaBootstrapAdapter({
    workspaceRepository: new EncounterWorkspaceRepository(repo.driveStore),
  })
}

describe('EncounterWorkspaceLoadAdapter (compat actaBootstrap)', () => {
  it('1. carga desde workspace con acta abierta', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = baseContext({ matchStatus: 'acta_abierta' })
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata({ status: 'ACTA_EN_CURSO' }),
      report: emptyMatchReport(context),
      encounterNumber: 1,
      documentName: buildActaDocumentName('Fase I', 1),
    })
    await repo.save(doc, { intent: 'draft' })

    const result = await workspaceLoader(repo).load({ context })

    expect(result.source).toBe('workspace_acta')
    expect(result.lifecycle).toBe('ACTA_EN_CURSO')
    expect(result.document?.match.matchId).toBe(context.encuentroId)
    expect(result.workspaceVersion).toBeGreaterThanOrEqual(1)
    expect(result.report.cerrada).toBe(false)
    expect(result.report.fromActaSnapshot).toBe(true)
  })

  it('2. carga desde workspace con acta cerrada', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = baseContext({ matchStatus: 'acta_cerrada' })
    const report = emptyMatchReport(context)
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata({
        status: 'ACTA_CERRADA',
        closedAt: '2026-05-21T13:00:00.000Z',
        closedBy: 'staff',
      }),
      report: {
        ...report,
        local: { ...report.local, classification: { P: 3, BO: 0, BD: 0, Total: 3 } },
      },
      encounterNumber: 2,
      documentName: buildActaDocumentName('Fase I', 2),
    })
    await repo.save(doc, { intent: 'draft' })
    const open = (await repo.load(matchKeyFromContext(context)))!
    await repo.save(open, { intent: 'close', expectedDocumentVersion: 1 })

    const result = await workspaceLoader(repo).load({ context })

    expect(result.source).toBe('workspace_acta')
    expect(result.lifecycle).toBe('ACTA_CERRADA')
    expect(result.report.cerrada).toBe(true)
    expect(result.report.local.classification.Total).toBe(3)
  })

  it('3. SUPERSEDED — alignments documentales sin legacy', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = baseContext({ equipoLocal: 'LOC_S', equipoVisitante: 'VIS_S' })
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata({
        status: 'ACTA_CERRADA',
        closedAt: '2026-05-21T13:00:00.000Z',
        encounterWorkflow: { actaBinding: 'SUPERSEDED' },
      }),
      report: emptyMatchReport(context),
      encounterNumber: 9,
      documentName: buildActaDocumentName('Fase I', 9),
    })
    repo.driveStore.injectRawWorkspace(matchKeyFromContext(context), legacyActaDocumentToWorkspace(doc))

    const spy = vi.spyOn(hydrationAdapter, 'hydrateMatchReportFromActaDocument')
    const result = await workspaceLoader(repo).load({ context })

    expect(result.source).toBe('workspace_alignments')
    expect(result.report.fromActaSnapshot).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('4. sin fichero previo — materializa shell workspace', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = baseContext()

    const result = await workspaceLoader(repo).load({ context })

    expect(result.source).toBe('workspace_shell')
    expect(result.lifecycle).toBe('NO_EXISTE')
    expect(result.document).toBeUndefined()
    expect(result.workspace.acta).toBeNull()
    expect(result.report.fromActaSnapshot).toBe(false)
    expect(repo.driveStore.getFiles().size).toBeGreaterThan(0)
  })

  it('5. corrupción documental — error tipado', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = baseContext()
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata({ status: 'ACTA_CERRADA' }),
      report: emptyMatchReport(context),
      encounterNumber: 3,
      documentName: buildActaDocumentName('Fase I', 3),
    })
    await repo.save(doc, { intent: 'draft' })
    repo.driveStore.injectCorruptOfficial(matchKeyFromContext(context), doc.match.documentName, '{invalid json')

    await expect(workspaceLoader(repo).load({ context })).rejects.toMatchObject({
      code: 'CORRUPT_DOCUMENT',
    } satisfies Partial<EncounterWorkspaceLoadError>)
  })

  it('6. hydrate failure — HYDRATE_FAILED', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = baseContext()
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata(),
      report: emptyMatchReport(context),
      encounterNumber: 4,
      documentName: buildActaDocumentName('Fase I', 4),
    })
    await repo.save(doc, { intent: 'draft' })

    vi.spyOn(hydrationAdapter, 'hydrateMatchReportFromActaDocument').mockImplementation(() => {
      throw new Error('hydrate broken')
    })

    await expect(workspaceLoader(repo).load({ context })).rejects.toMatchObject({
      code: 'HYDRATE_FAILED',
    })

    vi.restoreAllMocks()
  })

  it('7. corrupción tras mutación inválida — sin recuperación silenciosa', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = baseContext()
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata(),
      report: emptyMatchReport(context),
      encounterNumber: 5,
      documentName: buildActaDocumentName('Fase I', 5),
    })
    await repo.save(doc, { intent: 'draft' })
    const key = matchKeyFromContext(context)
    const stored = (await repo.load(key))!
    stored.metadata.status = 'ACTA_CERRADA'
    repo.driveStore.injectRawDocument(key, stored)

    await expect(workspaceLoader(repo).load({ context })).rejects.toThrow(EncounterWorkspaceLoadError)
  })

  it('8. lifecycle por rama', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const ctxOpen = baseContext()
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata(),
      report: emptyMatchReport(ctxOpen),
      encounterNumber: 6,
      documentName: buildActaDocumentName('Fase I', 6),
    })
    await repo.save(doc, { intent: 'draft' })
    expect((await workspaceLoader(repo).load({ context: ctxOpen })).lifecycle).toBe('ACTA_EN_CURSO')

    const emptyRepo = createFakeDriveJsonPersistenceRepository()
    expect((await workspaceLoader(emptyRepo).load({ context: baseContext() })).lifecycle).toBe(
      'NO_EXISTE',
    )
  })

  it('9. source correcto acta vs shell', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = baseContext()
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata(),
      report: emptyMatchReport(context),
      encounterNumber: 7,
      documentName: buildActaDocumentName('Fase I', 7),
    })
    await repo.save(doc, { intent: 'draft' })
    expect((await workspaceLoader(repo).load({ context })).source).toBe('workspace_acta')

    const emptyRepo = createFakeDriveJsonPersistenceRepository()
    expect((await workspaceLoader(emptyRepo).load({ context })).source).toBe('workspace_shell')
  })
})
