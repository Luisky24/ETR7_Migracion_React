import { describe, expect, it, vi } from 'vitest'
import * as hydrationAdapter from '../adapters/actaHydration.adapter'
import * as workspaceHydration from '../adapters/workspaceHydration.adapter'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import type { ActaDocumentMetadata } from '../contracts'
import { EncounterWorkspaceLoadError } from '../infra/encounterWorkspaceLoad.errors'
import { createEncounterWorkspaceLoadAdapter } from '../infra/encounterWorkspaceLoad.adapter'
import { matchKeyFromContext } from '../persistence/matchKey'
import { createFakeDriveJsonPersistenceRepository } from '../infra/jsonPersistence.adapter'
import { EncounterWorkspaceRepository } from '../persistence/encounterWorkspace.repository'
import { reconcileEncounterWorkspace } from '../tools/reconcileActaCalendar'
import { baseContext, emptyMatchReport } from './fixtures'
import { mergeEncounterWorkflow } from '../utils/encounterWorkflow'
import { legacyActaDocumentToWorkspace } from '../adapters/workspaceActa.mapper'

function seedSupersededWorkspace(
  repo: ReturnType<typeof createFakeDriveJsonPersistenceRepository>,
  context: ReturnType<typeof baseContext>,
  metadata: Partial<ActaDocumentMetadata>,
  report = emptyMatchReport(context),
) {
  const doc = projectMatchReportToActaDocument({
    metadata: baseMetadata(metadata),
    report,
    encounterNumber: 9,
    documentName: buildActaDocumentName('Fase I', 9),
  })
  const ws = legacyActaDocumentToWorkspace(doc)
  repo.driveStore.injectRawWorkspace(matchKeyFromContext(context), ws)
  return { doc, ws }
}

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

function loadAdapter(repo: ReturnType<typeof createFakeDriveJsonPersistenceRepository>) {
  return createEncounterWorkspaceLoadAdapter({
    workspaceRepository: new EncounterWorkspaceRepository(repo.driveStore),
  })
}

function isolatedContext(suffix: string) {
  return baseContext({
    equipoLocal: `LOCAL_${suffix}`,
    equipoVisitante: `VIS_${suffix}`,
  })
}

describe('EncounterWorkspace hydration', () => {
  it('workspace vacío (acta null) — shell editable desde alignments', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = isolatedContext('empty')
    const loader = loadAdapter(repo)
    const result = await loader.load({ context })

    expect(result.source).toBe('workspace_shell')
    expect(result.lifecycle).toBe('NO_EXISTE')
    expect(result.workspace.acta).toBeNull()
    expect(result.report.fromActaSnapshot).toBe(false)
    expect(result.report.cerrada).toBe(false)
    expect(repo.driveStore.getFiles().size).toBeGreaterThan(0)
  })

  it('workspace con acta ACTIVE — hidrata MatchReport', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = isolatedContext('active')
    const ctx = { ...context, matchStatus: 'acta_abierta' as const }
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata({ status: 'ACTA_EN_CURSO' }),
      report: emptyMatchReport(ctx),
      encounterNumber: 1,
      documentName: buildActaDocumentName('Fase I', 1),
    })
    await repo.save(doc, { intent: 'draft' })

    const result = await loadAdapter(repo).load({ context: ctx })
    expect(result.source).toBe('workspace_acta')
    expect(result.lifecycle).toBe('ACTA_EN_CURSO')
    expect(result.report.fromActaSnapshot).toBe(true)
    expect(result.document?.match.matchId).toBe(context.encuentroId)
  })

  it('workspace SUPERSEDED — alignments documentales, no acta editable', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = isolatedContext('superseded')
    seedSupersededWorkspace(repo, context, {
      status: 'ACTA_CERRADA',
      closedAt: '2026-05-21T13:00:00.000Z',
      encounterWorkflow: { actaBinding: 'SUPERSEDED' },
    })

    const spy = vi.spyOn(hydrationAdapter, 'hydrateMatchReportFromActaDocument')
    const result = await loadAdapter(repo).load({ context })

    expect(result.source).toBe('workspace_alignments')
    expect(result.report.fromActaSnapshot).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('hydrate draft vs closed acta', async () => {
    const closedRepo = createFakeDriveJsonPersistenceRepository()
    const closedContext = isolatedContext('closed')
    const closedCtx = { ...closedContext, matchStatus: 'acta_cerrada' as const }
    const report = emptyMatchReport(closedCtx)
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata({
        status: 'ACTA_CERRADA',
        closedAt: '2026-05-21T13:00:00.000Z',
        closedBy: 'staff',
      }),
      report: {
        ...report,
        local: { ...report.local, classification: { P: 2, BO: 0, BD: 0, Total: 2 } },
      },
      encounterNumber: 2,
      documentName: buildActaDocumentName('Fase I', 2),
    })
    await closedRepo.save(doc, { intent: 'draft' })
    const open = (await closedRepo.load(matchKeyFromContext(closedCtx)))!
    await closedRepo.save(open, { intent: 'close', expectedDocumentVersion: 1 })

    const closed = await loadAdapter(closedRepo).load({ context: closedCtx })
    expect(closed.lifecycle).toBe('ACTA_CERRADA')
    expect(closed.report.cerrada).toBe(true)

    const draftRepo = createFakeDriveJsonPersistenceRepository()
    const draftContext = isolatedContext('draft')
    const draftCtx = { ...draftContext, matchStatus: 'acta_abierta' as const }
    const draftDoc = projectMatchReportToActaDocument({
      metadata: baseMetadata({ status: 'ACTA_EN_CURSO' }),
      report: emptyMatchReport(draftCtx),
      encounterNumber: 3,
      documentName: buildActaDocumentName('Fase I', 3),
    })
    await draftRepo.save(draftDoc, { intent: 'draft' })
    const draft = await loadAdapter(draftRepo).load({ context: draftCtx })
    expect(draft.lifecycle).toBe('ACTA_EN_CURSO')
    expect(draft.report.cerrada).toBe(false)
  })

  it('corrupción workspace — error tipado', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = isolatedContext('corrupt')
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata(),
      report: emptyMatchReport(context),
      encounterNumber: 4,
      documentName: buildActaDocumentName('Fase I', 4),
    })
    await repo.save(doc, { intent: 'draft' })
    repo.driveStore.injectCorruptOfficial(
      matchKeyFromContext(context),
      doc.match.documentName,
      '{invalid',
    )

    await expect(loadAdapter(repo).load({ context })).rejects.toMatchObject({
      code: 'CORRUPT_DOCUMENT',
    } satisfies Partial<EncounterWorkspaceLoadError>)
  })

  it('HYDRATE_FAILED cuando falla proyección acta', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = isolatedContext('hydrate_fail')
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata(),
      report: emptyMatchReport(context),
      encounterNumber: 5,
      documentName: buildActaDocumentName('Fase I', 5),
    })
    await repo.save(doc, { intent: 'draft' })

    vi.spyOn(hydrationAdapter, 'hydrateMatchReportFromActaDocument').mockImplementation(() => {
      throw new Error('hydrate broken')
    })

    await expect(loadAdapter(repo).load({ context })).rejects.toMatchObject({
      code: 'HYDRATE_FAILED',
    })
    vi.restoreAllMocks()
  })

  it('reconcile workspace mismatch y SUPERSEDED info', async () => {
    const context = isolatedContext('reconcile')
    const wsRepo = createFakeDriveJsonPersistenceRepository()
    const { ws } = seedSupersededWorkspace(wsRepo, context, {
      status: 'ACTA_CERRADA',
      closedAt: '2026-05-21T13:00:00.000Z',
      encounterWorkflow: { actaBinding: 'SUPERSEDED' },
    })
    const key = matchKeyFromContext(context)
    expect(ws).not.toBeNull()

    const report = reconcileEncounterWorkspace({
      matchId: 'otro-id',
      workspace: ws,
      calendar: null,
      resultados: null,
      syncLedger: [],
    })
    expect(report.findings.some((f) => f.code === 'WORKSPACE_MATCH_ID_MISMATCH')).toBe(true)
    expect(report.findings.some((f) => f.code === 'WORKSPACE_ACTA_SUPERSEDED')).toBe(true)
  })

  it('reopen alignments — binding SUPERSEDED hidrata desde alignments', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = isolatedContext('reopen')
    const ctx = { ...context, matchStatus: 'alineacion_parcial' as const }
    seedSupersededWorkspace(
      repo,
      ctx,
      {
        status: 'ACTA_CERRADA',
        closedAt: '2026-05-21T13:00:00.000Z',
        encounterWorkflow: mergeEncounterWorkflow(undefined, {
          actaBinding: 'SUPERSEDED',
          lastReopen: {
            mode: 'REOPEN_ALIGNMENTS',
            at: '2026-05-21T14:00:00.000Z',
            by: 'staff',
            fromDocumentVersion: 1,
          },
        }),
      },
      emptyMatchReport(ctx),
    )
    const result = await loadAdapter(repo).load({ context: ctx })
    expect(result.source).toBe('workspace_alignments')
    expect(result.workspace.workflow.actaBinding).toBe('SUPERSEDED')
  })

  it('stale workspaceVersion no impide lectura', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = isolatedContext('stale')
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata({ documentVersion: 1 }),
      report: emptyMatchReport(context),
      encounterNumber: 8,
      documentName: buildActaDocumentName('Fase I', 8),
    })
    await repo.save(doc, { intent: 'draft' })
    const result = await loadAdapter(repo).load({ context })
    expect(result.workspaceVersion).toBeGreaterThanOrEqual(1)
  })

  it('hydrate desde alignments puro', () => {
    const context = baseContext()
    const shell = workspaceHydration.hydrateMatchReportFromWorkspaceAlignments(
      {
        identity: {
          matchId: context.encuentroId,
          category: 'Senior',
          phase: 'Fase I',
          encounter: {
            grupo: context.grupo,
            equipoLocal: context.equipoLocal,
            equipoVisitante: context.equipoVisitante,
            hora: context.hora,
            campo: context.campo,
            encounterNumber: 1,
          },
          storageKey: 'k',
          documentFileName: 'ENC_WS_Fase1_Encuentro1',
        },
        metadata: {
          schemaVersion: 1,
          workspaceVersion: 1,
          createdAt: '2026-05-21T12:00:00.000Z',
          updatedAt: '2026-05-21T12:00:00.000Z',
          createdBy: 'test',
          lastMutationBy: 'test',
          lastMutationKind: 'WORKSPACE_CREATE',
        },
        lifecycle: {
          phase: 'workspace_created',
          phaseChangedAt: '2026-05-21T12:00:00.000Z',
          phaseChangedBy: 'test',
        },
        workflow: { actaBinding: 'ACTIVE' },
        calendarRef: { rowKey: { grupo: context.grupo, equipoLocal: context.equipoLocal, equipoVisitante: context.equipoVisitante } },
        alignments: {
          schemaVersion: 1,
          gate: 'not_started',
          local: {
            side: 'local',
            equipo: context.equipoLocal,
            delegado: 'DL',
            entrenador: 'EL',
            players: [{ playerId: 'p1', jugador: 'A', dorsal: 1, titular: true, suplente: false, capitan: false }],
          },
          visitante: {
            side: 'visitante',
            equipo: context.equipoVisitante,
            delegado: 'DV',
            entrenador: 'EV',
            players: [{ playerId: 'p2', jugador: 'B', dorsal: 2, titular: true, suplente: false, capitan: false }],
          },
        },
        officials: {},
        acta: null,
        sync: { ledger: [] },
        audit: { events: [] },
      } as never,
      { context },
    )
    expect(shell.fromActaSnapshot).toBe(false)
    expect(shell.local.equipo).toBe(context.equipoLocal)
  })
})
