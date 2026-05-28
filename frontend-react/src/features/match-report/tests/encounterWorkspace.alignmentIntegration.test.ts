import { describe, expect, it } from 'vitest'
import { createEncounterWorkspaceLoadAdapter } from '../infra/encounterWorkspaceLoad.adapter'
import { EncounterWorkspaceRepository } from '../persistence/encounterWorkspace.repository'
import { FakeDriveEncounterWorkspaceStore } from '../infra/fakeDriveEncounterWorkspaceStore'
import { baseContext, emptyMatchReport } from './fixtures'
import {
  AlignmentDocumentRepository,
  FakeDriveAlignmentDocumentStore,
  type AlignmentDocumentKey,
} from '@/features/alineaciones-v2/persistence/alignmentDocument.repository'
import type { AlignmentDocumentV1 } from '@/shared/contracts/alignment.document'
import { createFakeDriveJsonPersistenceRepository } from '../infra/jsonPersistence.adapter'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'

let tick = 0
function now(): string {
  tick += 1
  return `2026-05-28T12:00:${String(tick).padStart(2, '0')}.000Z`
}

function alignmentKeyFromContext(ctx: ReturnType<typeof baseContext>, teamId: string): AlignmentDocumentKey {
  // A3.5 tests: usamos ids "simples" derivados del contexto.
  return {
    categoryId: ctx.category,
    seasonId: '2026',
    phaseId: 'FASE1',
    phaseCode: 'FASE1',
    matchId: ctx.encuentroId,
    encounterId: 'J12',
    encounterCode: 'J12',
    teamId,
    teamCode: teamId,
    roleInMatch: teamId === ctx.equipoLocal ? 'LOCAL' : 'VISITANTE',
    storageKey: `${ctx.category}::2026::FASE1::${ctx.encuentroId}::${teamId}`,
  }
}

function closedAlignmentDoc(key: AlignmentDocumentKey, closedBy = 'delegate'): AlignmentDocumentV1 {
  const players = [
    { playerId: 'p1', displayName: 'P1', dorsal: 1 },
    { playerId: 'p2', displayName: 'P2', dorsal: 2 },
  ] as const
  const selection = { starters: ['p1'], bench: ['p2'], captain: 'p1', goalkeeper: null }
  return {
    schema: 'AlignmentDocumentV1',
    identity: {
      categoryId: key.categoryId,
      seasonId: key.seasonId,
      teamId: key.teamId,
      matchId: key.matchId,
      phaseId: key.phaseId,
      encounterId: key.encounterId,
      storageKey: key.storageKey,
      documentFileName: `ALI_${key.teamCode}_${key.phaseCode}_${key.encounterCode}.json`,
    },
    metadata: {
      schemaVersion: 1,
      documentVersion: 2,
      createdAt: now(),
      updatedAt: now(),
      createdBy: 't',
      updatedBy: 't',
    },
    team: { teamId: key.teamId, teamCode: key.teamCode, roleInMatch: key.roleInMatch },
    match: {
      phaseId: key.phaseId,
      phaseCode: key.phaseCode,
      encounterId: key.encounterId,
      encounterCode: key.encounterCode,
      matchId: key.matchId,
    },
    players,
    selection,
    lifecycle: {
      state: 'CLOSED',
      history: [{ from: 'IN_PROGRESS', to: 'CLOSED', at: now(), by: closedBy }],
    },
    closure: {
      closedAt: now(),
      closedBy,
      closeRevision: 1,
      snapshot: { players, selection },
    },
    audit: { events: [{ at: now(), by: closedBy, kind: 'ALIGNMENT_CLOSED' }] },
    sync: {},
  }
}

describe('A3.5 AlignmentDocument ↔ Encounter Workspace', () => {
  it('materializa workspace.alignments desde AlignmentDocument snapshots CLOSED', async () => {
    tick = 0
    const ctx = baseContext({ equipoLocal: 'L1', equipoVisitante: 'V1' })

    const wsStore = new FakeDriveEncounterWorkspaceStore()
    const wsRepo = new EncounterWorkspaceRepository(wsStore)

    const alStore = new FakeDriveAlignmentDocumentStore()
    const alRepo = new AlignmentDocumentRepository(alStore, { now, bootstrapper: { bootstrapPlayersFromSheets: async () => [] } })

    const localKey = alignmentKeyFromContext(ctx, ctx.equipoLocal)
    const awayKey = alignmentKeyFromContext(ctx, ctx.equipoVisitante)
    alStore.injectRawDocument('ALI_L1_FASE1_J12', closedAlignmentDoc(localKey))
    alStore.injectRawDocument('ALI_V1_FASE1_J12', closedAlignmentDoc(awayKey))

    const loader = createEncounterWorkspaceLoadAdapter({
      workspaceRepository: wsRepo,
      alignmentRepository: alRepo,
      resolveAlignmentKeys: () => ({ local: localKey, visitante: awayKey }),
      createdBy: 'test',
    })

    const result = await loader.load({ context: ctx })
    expect(result.workspace.alignments.local.estado).toBe('C')
    expect(result.workspace.alignments.visitante.estado).toBe('C')
    expect(result.workspace.alignments.gate).toBe('both_closed')
    expect(result.workspace.alignments.local.alignmentRef?.storageKey).toBe(localKey.storageKey)
    expect(result.report.local.players.some((p) => p.jugador === 'P1')).toBe(true)
  })

  it('Alignment REOPENED + acta ACTIVE => binding SUPERSEDED y no hidrata acta', async () => {
    tick = 0
    const ctx = baseContext({ equipoLocal: 'L2', equipoVisitante: 'V2', matchStatus: 'acta_abierta' as const })
    const jsonRepo = createFakeDriveJsonPersistenceRepository({ now })
    const report = emptyMatchReport(ctx)
    const acta = projectMatchReportToActaDocument({
      metadata: { schemaVersion: 1, documentVersion: 1, status: 'ACTA_EN_CURSO', createdAt: now(), updatedAt: now() },
      report,
      encounterNumber: 1,
      documentName: buildActaDocumentName('Fase I', 1),
    })
    await jsonRepo.save(acta, { intent: 'draft', savedBy: 'u1' })
    const wsRepo = new EncounterWorkspaceRepository(jsonRepo.driveStore)

    const alStore = new FakeDriveAlignmentDocumentStore()
    const alRepo = new AlignmentDocumentRepository(alStore, { now, bootstrapper: { bootstrapPlayersFromSheets: async () => [] } })

    const localKey = alignmentKeyFromContext(ctx, ctx.equipoLocal)
    const awayKey = alignmentKeyFromContext(ctx, ctx.equipoVisitante)
    // local CLOSED, visitante REOPENED
    alStore.injectRawDocument('ALI_L2_FASE1_J12', closedAlignmentDoc(localKey))
    const reopenedAway: AlignmentDocumentV1 = {
      ...closedAlignmentDoc(awayKey),
      lifecycle: {
        state: 'REOPENED',
        history: [
          { from: 'IN_PROGRESS', to: 'CLOSED', at: now(), by: 'd' },
          { from: 'CLOSED', to: 'REOPENED', at: now(), by: 'd', reason: 'change' },
        ],
      },
      audit: { events: [{ at: now(), by: 'd', kind: 'ALIGNMENT_REOPENED', reason: 'change' }] },
      metadata: { ...closedAlignmentDoc(awayKey).metadata, documentVersion: 3 },
    }
    alStore.injectRawDocument('ALI_V2_FASE1_J12', reopenedAway)

    const loader = createEncounterWorkspaceLoadAdapter({
      workspaceRepository: wsRepo,
      alignmentRepository: alRepo,
      resolveAlignmentKeys: () => ({ local: localKey, visitante: awayKey }),
      createdBy: 'test',
    })
    const result = await loader.load({ context: ctx })
    expect(result.workspace.workflow.actaBinding).toBe('SUPERSEDED')
    expect(result.workspace.acta?.status).toBe('ACTA_CERRADA')
    expect(result.source).toBe('workspace_alignments')
  })
})

