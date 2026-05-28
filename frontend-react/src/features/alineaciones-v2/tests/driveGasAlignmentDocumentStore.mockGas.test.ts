import { describe, expect, it } from 'vitest'
import { gasTransport } from '@/transport/gasTransport'
import { DriveGasAlignmentDocumentStore } from '../infra/driveGasAlignmentDocumentStore'
import type { AlignmentDocumentV1 } from '@/shared/contracts/alignment.document'

describe('DriveGasAlignmentDocumentStore (local-dev mockGas)', () => {
  it('probe/read/write roundtrip via alignmentJson_* mocks', async () => {
    const store = new DriveGasAlignmentDocumentStore({ categoryId: 'M', phaseId: 'Fase I' })
    const key = {
      storageKey: 'M::2026::FASE1::A|L|V::L',
      matchId: 'A|L|V',
      categoryId: 'M',
      seasonId: '2026',
      teamId: 'L',
      teamCode: 'L',
      roleInMatch: 'LOCAL' as const,
      phaseId: 'FASE1',
      phaseCode: 'FASE1',
      encounterId: 'J1',
      encounterCode: 'J1',
    }

    const doc: AlignmentDocumentV1 = {
      schema: 'AlignmentDocumentV1',
      identity: {
        categoryId: key.categoryId,
        seasonId: key.seasonId,
        teamId: key.teamId,
        matchId: key.matchId,
        phaseId: key.phaseId,
        encounterId: key.encounterId,
        storageKey: key.storageKey,
        documentFileName: 'ALI_L_FASE1_J1.json',
      },
      metadata: {
        schemaVersion: 1,
        documentVersion: 1,
        createdAt: '2026-05-28T00:00:00.000Z',
        updatedAt: '2026-05-28T00:00:00.000Z',
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
      players: [{ playerId: 'p1', displayName: 'P1', dorsal: 1 }],
      selection: { starters: ['p1'], bench: [], captain: 'p1', goalkeeper: null },
      lifecycle: { state: 'DRAFT', history: [] },
      audit: { events: [] },
      sync: {},
    }

    expect(await store.probeDocumentState(key)).toBe('absent')
    await store.atomicReplace(key, doc)
    expect(await store.probeDocumentState(key)).toBe('valid')
    const loaded = await store.readCommitted(key)
    expect(loaded?.identity.storageKey).toBe(key.storageKey)
  })

  it('readIndexByContext works via mock handler', async () => {
    // sanity: call transport directly to ensure handler exists
    const res = await gasTransport.call('alignmentJson_readIndexByContext', {
      categoryId: 'M',
      phaseId: 'Fase I',
    })
    expect(res).toBeTruthy()
  })
})

