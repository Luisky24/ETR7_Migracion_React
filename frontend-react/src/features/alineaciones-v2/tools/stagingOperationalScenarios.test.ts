import { describe, expect, it } from 'vitest'
import { scenarioA_bootstrap } from './stagingOperationalScenarios'
import {
  AlignmentDocumentRepository,
  FakeDriveAlignmentDocumentStore,
  type AlignmentDocumentKey,
} from '../persistence/alignmentDocument.repository'
import { EncounterWorkspaceRepository } from '@/features/match-report/persistence/encounterWorkspace.repository'
import { FakeDriveEncounterWorkspaceStore } from '@/features/match-report/infra/fakeDriveEncounterWorkspaceStore'

describe('A3.8 stagingOperationalScenarios', () => {
  it('scenarioA_bootstrap creates drafts without touching runtime', async () => {
    const alStore = new FakeDriveAlignmentDocumentStore()
    const alignmentRepo = new AlignmentDocumentRepository(alStore, {
      now: () => '2026-05-28T00:00:00.000Z',
      bootstrapper: { bootstrapPlayersFromSheets: async () => [{ playerId: 'p1', displayName: 'P1', dorsal: 1 }] },
    })
    const wsRepo = new EncounterWorkspaceRepository(new FakeDriveEncounterWorkspaceStore())

    const resolveKeys = (matchId: string) => {
      const mk = (teamId: string): AlignmentDocumentKey => ({
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
      })
      return { local: mk('L'), visitante: mk('V') }
    }

    const res = await scenarioA_bootstrap(
      { alignmentRepo, workspaceRepo: wsRepo, resolveKeys, createdBy: 't' },
      'A|L|V',
    )
    expect(res.ok).toBe(true)
    expect(res.steps.some((s) => s.step.includes('draft created') && s.ok)).toBe(true)
  })
})

