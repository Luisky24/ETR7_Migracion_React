import { describe, expect, it } from 'vitest'
import type { AlignmentDocumentV1 } from '@/shared/contracts/alignment.document'
import {
  AlignmentDocumentRepository,
  FakeDriveAlignmentDocumentStore,
  type AlignmentDocumentKey,
} from '../persistence/alignmentDocument.repository'
import {
  backupFileName,
  officialFileName,
  previousFileName,
} from '../persistence/alignmentRepositoryKeys'

let tick = 0
function now(): string {
  tick += 1
  return `2026-05-28T10:00:${String(tick).padStart(2, '0')}.000Z`
}

function key(overrides: Partial<AlignmentDocumentKey> = {}): AlignmentDocumentKey {
  const base: AlignmentDocumentKey = {
    storageKey: 'M::2026::FASE1::G1|CRAT|RIVAL::CRAT',
    matchId: 'G1|CRAT|RIVAL',
    categoryId: 'M',
    seasonId: '2026',
    teamId: 'CRAT',
    teamCode: 'CRAT',
    roleInMatch: 'LOCAL',
    phaseId: 'FASE1',
    phaseCode: 'FASE1',
    encounterId: 'J12',
    encounterCode: 'J12',
  }
  return { ...base, ...overrides }
}

function minimalPlayers() {
  return [
    { playerId: 'p1', displayName: 'P1', dorsal: 1 },
    { playerId: 'p2', displayName: 'P2', dorsal: 2 },
  ] as const
}

describe('AlignmentDocumentRepository (FakeDrive)', () => {
  it('ensureAlignmentDraft bootstraps desde Sheets cuando no hay índice', async () => {
    tick = 0
    const store = new FakeDriveAlignmentDocumentStore()
    const repo = new AlignmentDocumentRepository(store, {
      now,
      bootstrapper: {
        bootstrapPlayersFromSheets: async () => [...minimalPlayers()],
      },
    })

    const doc = await repo.ensureAlignmentDraft(key(), 'u1')
    expect(doc.metadata.documentVersion).toBe(1)
    expect(doc.lifecycle.state).toBe('DRAFT')
    expect(doc.players.length).toBe(2)
    expect(await repo.probeAlignmentDocument(key())).toBe('valid')
  })

  it('saveAlignmentDraft increments documentVersion + optimistic locking', async () => {
    tick = 0
    const store = new FakeDriveAlignmentDocumentStore()
    const repo = new AlignmentDocumentRepository(store, {
      now,
      bootstrapper: { bootstrapPlayersFromSheets: async () => [...minimalPlayers()] },
    })
    const draft = await repo.ensureAlignmentDraft(key(), 'u1')

    const saved = await repo.saveAlignmentDraft(key(), draft, { expectedDocumentVersion: 1, savedBy: 'u2' })
    expect(saved.metadata.documentVersion).toBe(2)

    await expect(
      repo.saveAlignmentDraft(key(), draft, { expectedDocumentVersion: 1, savedBy: 'u3' }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_VERSION_CONFLICT' })
  })

  it('closeAlignment increments documentVersion + closeRevision and updates index only on first close', async () => {
    tick = 0
    const store = new FakeDriveAlignmentDocumentStore()
    const repo = new AlignmentDocumentRepository(store, {
      now,
      bootstrapper: { bootstrapPlayersFromSheets: async () => [...minimalPlayers()] },
    })
    const draft = await repo.ensureAlignmentDraft(key(), 'u1')
    const inProgress = await repo.saveAlignmentDraft(key(), {
      ...draft,
      lifecycle: {
        state: 'IN_PROGRESS',
        history: [{ from: 'DRAFT', to: 'IN_PROGRESS', at: now(), by: 'u1' }],
      },
    }, { expectedDocumentVersion: 1, savedBy: 'u1' })
    const closed = await repo.closeAlignment(key(), inProgress, { expectedDocumentVersion: 2, closedBy: 'd1' })
    expect(closed.metadata.documentVersion).toBe(3)
    expect(closed.closure?.closeRevision).toBe(1)
    expect(closed.lifecycle.state).toBe('CLOSED')

    const reopened = await repo.reopenAlignment(key(), closed, {
      expectedDocumentVersion: 3,
      reopenedBy: 'd1',
      reason: 'test',
    })
    expect(reopened.metadata.documentVersion).toBe(4)
    expect(reopened.closure?.closeRevision).toBe(1)
    expect(reopened.lifecycle.state).toBe('REOPENED')

    const closedAgain = await repo.closeAlignment(key(), reopened, { expectedDocumentVersion: 4, closedBy: 'd1' })
    expect(closedAgain.closure?.closeRevision).toBe(2)

    // Index debe apuntar al primer close (closeRevision=1) y no cambiar por segundo close.
    const rawIndex = await store.readIndexRaw()
    expect(rawIndex).toBeTruthy()
    const index = rawIndex as { byTeamId: Record<string, { closeRevision: number }> }
    expect(index.byTeamId['CRAT']?.closeRevision).toBe(1)
  })

  it('atomic replace creates backup + previous on second write', async () => {
    tick = 0
    const store = new FakeDriveAlignmentDocumentStore()
    const repo = new AlignmentDocumentRepository(store, {
      now,
      bootstrapper: { bootstrapPlayersFromSheets: async () => [...minimalPlayers()] },
    })
    const k = key()
    const draft1 = await repo.ensureAlignmentDraft(k, 'u1')
    const saved = await repo.saveAlignmentDraft(k, draft1, { expectedDocumentVersion: 1, savedBy: 'u2' })

    const files = store.getFiles()
    const docName = 'ALI_CRAT_FASE1_J12'
    expect(files.get(officialFileName(docName))?.content).toContain('"documentVersion":2')
    expect(files.get(previousFileName(docName))?.content).toContain('"documentVersion":1')
    expect(files.get(backupFileName(docName))?.content).toContain('"documentVersion":1')
    expect(saved.metadata.documentVersion).toBe(2)
  })

  it('corrupt document yields probe corrupt', async () => {
    const store = new FakeDriveAlignmentDocumentStore()
    store.injectCorruptOfficial(key().storageKey, 'ALI_CRAT_FASE1_J12', '{not-json')
    const repo = new AlignmentDocumentRepository(store, { now, bootstrapper: { bootstrapPlayersFromSheets: async () => [] } })
    expect(await repo.probeAlignmentDocument(key())).toBe('corrupt')
  })

  it('rebuildAlignmentIndex chooses latest firstClosedAt per team', async () => {
    tick = 0
    const store = new FakeDriveAlignmentDocumentStore()
    const repo = new AlignmentDocumentRepository(store, { now, bootstrapper: { bootstrapPlayersFromSheets: async () => [...minimalPlayers()] } })

    const k1 = key({
      matchId: 'G1|CRAT|RIVAL|J10',
      encounterId: 'J10',
      encounterCode: 'J10',
      storageKey: 'M::2026::FASE1::G1|CRAT|RIVAL|J10::CRAT',
    })
    await repo.ensureAlignmentDraft(k1, 'u1')
    const d1 = await repo.loadAlignmentDocument(k1)
    const p1 = await repo.saveAlignmentDraft(k1, {
      ...d1!,
      lifecycle: { state: 'IN_PROGRESS', history: [{ from: 'DRAFT', to: 'IN_PROGRESS', at: now(), by: 'u1' }] },
    }, { expectedDocumentVersion: 1, savedBy: 'u1' })
    const c1 = await repo.closeAlignment(k1, p1, { expectedDocumentVersion: 2, closedBy: 'd' })
    expect(c1.closure?.closeRevision).toBe(1)

    const k2 = key({
      matchId: 'G1|CRAT|RIVAL|J12',
      encounterId: 'J12',
      encounterCode: 'J12',
      storageKey: 'M::2026::FASE1::G1|CRAT|RIVAL|J12::CRAT',
    })
    await repo.ensureAlignmentDraft(k2, 'u1')
    const d2 = await repo.loadAlignmentDocument(k2)
    const p2 = await repo.saveAlignmentDraft(k2, {
      ...d2!,
      lifecycle: { state: 'IN_PROGRESS', history: [{ from: 'DRAFT', to: 'IN_PROGRESS', at: now(), by: 'u1' }] },
    }, { expectedDocumentVersion: 1, savedBy: 'u1' })
    await repo.closeAlignment(k2, p2, { expectedDocumentVersion: 2, closedBy: 'd' })

    const rebuilt = await repo.rebuildAlignmentIndex(now())
    expect(rebuilt.byTeamId['CRAT']).toBeTruthy()
  })
})

