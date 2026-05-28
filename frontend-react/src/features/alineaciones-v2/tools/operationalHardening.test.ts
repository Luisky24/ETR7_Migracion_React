import { describe, expect, it } from 'vitest'
import {
  AlignmentDocumentRepository,
  FakeDriveAlignmentDocumentStore,
  type AlignmentDocumentKey,
} from '../persistence/alignmentDocument.repository'
import { FakeDriveEncounterWorkspaceStore } from '@/features/match-report/infra/fakeDriveEncounterWorkspaceStore'
import { EncounterWorkspaceRepository } from '@/features/match-report/persistence/encounterWorkspace.repository'
import { scenarioE_concurrentWrites } from './stagingOperationalScenarios'
import { dumpAlignmentLifecycle } from './operationalDiagnostics'

function nowFactory() {
  let tick = 0
  return () => {
    tick += 1
    return `2026-05-28T12:50:${String(tick).padStart(2, '0')}.000Z`
  }
}

function key(teamId: string, matchId = 'A|L|V'): AlignmentDocumentKey {
  return {
    categoryId: 'M',
    seasonId: '2026',
    phaseId: 'FASE1',
    phaseCode: 'FASE1',
    matchId,
    encounterId: 'J1',
    encounterCode: 'J1',
    teamId,
    teamCode: teamId,
    roleInMatch: teamId === 'L' ? 'LOCAL' : 'VISITANTE',
    storageKey: `M::2026::FASE1::${matchId}::${teamId}`,
  }
}

describe('A3.9 operational hardening (fake stores)', () => {
  it('concurrent writes: one ok, one conflict', async () => {
    const now = nowFactory()
    const store = new FakeDriveAlignmentDocumentStore()
    const repo = new AlignmentDocumentRepository(store, {
      now,
      bootstrapper: { bootstrapPlayersFromSheets: async () => [{ playerId: 'p1', displayName: 'P1', dorsal: 1 }] },
    })
    const wsRepo = new EncounterWorkspaceRepository(new FakeDriveEncounterWorkspaceStore())
    const res = await scenarioE_concurrentWrites(
      {
        alignmentRepo: repo,
        workspaceRepo: wsRepo,
        resolveKeys: () => ({ local: key('L'), visitante: key('V') }),
        createdBy: 't',
      },
      'A|L|V',
    )
    expect(res.ok).toBe(true)
  })

  it('dumpAlignmentLifecycle returns stable summary', async () => {
    const now = nowFactory()
    const store = new FakeDriveAlignmentDocumentStore()
    const repo = new AlignmentDocumentRepository(store, {
      now,
      bootstrapper: { bootstrapPlayersFromSheets: async () => [{ playerId: 'p1', displayName: 'P1', dorsal: 1 }] },
    })
    const k = key('L')
    await repo.ensureAlignmentDraft(k, 't')
    const dump = await dumpAlignmentLifecycle(repo, k)
    expect(dump?.storageKey).toBe(k.storageKey)
    expect(dump?.documentVersion).toBeGreaterThanOrEqual(1)
  })
})

