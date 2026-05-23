import { describe, expect, it } from 'vitest'
import {
  backupFileName,
  officialFileName,
  previousFileName,
} from '../persistence/workspaceRepositoryKeys'
import { atomicReplaceWorkspaceInMap } from '../infra/workspaceDriveFilePipeline'
import {
  createEncounterWorkspace,
  createEncounterWorkspaceFromActaDocument,
} from '../adapters/workspaceActa.mapper'
import { deriveWorkspaceLifecyclePhase } from '@/shared/contracts/validateEncounterWorkspaceDocument'
import { createFakeDriveJsonPersistenceRepository } from '../infra/jsonPersistence.adapter'
import { EncounterWorkspaceRepository } from '../persistence/encounterWorkspace.repository'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import type { ActaDocumentMetadata } from '../contracts'
import { keyFromDocument } from '../persistence/actaRepositoryKeys'
import { emptyMatchReport } from './fixtures'

let tick = 0
function now(): string {
  tick += 1
  return `2026-05-22T16:00:${String(tick).padStart(2, '0')}.000Z`
}

function baseMetadata(overrides: Partial<ActaDocumentMetadata> = {}): ActaDocumentMetadata {
  return {
    schemaVersion: 1,
    documentVersion: 1,
    status: 'ACTA_EN_CURSO',
    createdAt: '2026-05-22T12:00:00.000Z',
    updatedAt: '2026-05-22T12:00:00.000Z',
    ...overrides,
  }
}

function sampleActa(status: ActaDocumentMetadata['status'] = 'ACTA_EN_CURSO') {
  const report = emptyMatchReport()
  return projectMatchReportToActaDocument({
    metadata: baseMetadata({ status }),
    report,
    encounterNumber: 14,
    documentName: buildActaDocumentName('Fase I', 14),
  })
}

describe('createEncounterWorkspace', () => {
  it('crea shell con alignments vacías y acta null', () => {
    const ws = createEncounterWorkspace({
      key: { category: 'M', phase: 'Fase I', matchId: 'G1|L|V' },
      encounterNumber: 14,
      grupo: 'G1',
      equipoLocal: 'L',
      equipoVisitante: 'V',
      hora: '10:00',
      campo: 'C',
      createdBy: 'gas',
    })
    expect(ws.acta).toBeNull()
    expect(ws.alignments.gate).toBe('not_started')
    expect(ws.officials).toEqual({})
    expect(ws.sync.ledger).toHaveLength(0)
    expect(ws.audit.events.length).toBeGreaterThan(0)
    expect(ws.identity.documentFileName).toMatch(/^ENC_WS_/)
  })
})

describe('EncounterWorkspace persistence (FakeDrive)', () => {
  it('save/load roundtrip vía ActaRepository', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const acta = sampleActa()
    const key = keyFromDocument(acta)
    const res = await repo.save(acta, { intent: 'draft', savedBy: 'u1' })
    expect(res.ok).toBe(true)
    const loaded = await repo.load(key)
    expect(loaded?.metadata.documentVersion).toBe(1)
    expect(loaded?.match.matchId).toBe(key.matchId)

    const wsRepo = new EncounterWorkspaceRepository(repo.driveStore)
    const ws = await wsRepo.loadWorkspace(key)
    expect(ws?.acta?.status).toBe('ACTA_EN_CURSO')
    expect(ws?.metadata.workspaceVersion).toBe(1)
    expect(deriveWorkspaceLifecyclePhase(ws!)).toBe('acta_in_progress')
  })

  it('optimistic locking — stale version', async () => {
    tick = 10
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const acta = sampleActa()
    const key = keyFromDocument(acta)
    await repo.save(acta, { intent: 'draft', savedBy: 'u1' })

    const stale = sampleActa()
    const conflict = await repo.save(
      { ...stale, metadata: { ...stale.metadata, documentVersion: 99 } },
      { intent: 'draft', expectedDocumentVersion: 99, savedBy: 'u2' },
    )
    expect(conflict.ok).toBe(false)
    if (conflict.ok) return
    expect(conflict.code).toBe('DOCUMENT_VERSION_CONFLICT')
  })

  it('atomic replace genera backup y previous en mapa', () => {
    const files = new Map<string, { content: string }>()
    const name = 'ENC_WS_Fase1_Encuentro1'
    const shell = createEncounterWorkspace({
      key: { category: 'M', phase: 'Fase I', matchId: 'x|a|b' },
      encounterNumber: 1,
      grupo: 'G',
      equipoLocal: 'A',
      equipoVisitante: 'B',
      hora: 'h',
      campo: 'c',
      createdBy: 't',
    })
    const v1 = JSON.stringify(shell)
    atomicReplaceWorkspaceInMap(files, name, v1)
    const acta = createEncounterWorkspaceFromActaDocument(sampleActa(), 't')
    const v2 = JSON.stringify(acta)
    const result = atomicReplaceWorkspaceInMap(files, name, v2)
    expect(result.ok).toBe(true)
    expect(files.get(officialFileName(name))?.content).toBe(v2)
    expect(files.get(backupFileName(name))?.content).toBe(v1)
    expect(files.get(previousFileName(name))?.content).toBe(v1)
  })

  it('append-only audit crece en cada save', async () => {
    tick = 20
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const acta = sampleActa()
    const key = keyFromDocument(acta)
    await repo.save(acta, { intent: 'draft', savedBy: 'u1' })
    const acta2 = sampleActa()
    await repo.save(
      { ...acta2, metadata: { ...acta2.metadata, documentVersion: 1 } },
      { intent: 'draft', expectedDocumentVersion: 1, savedBy: 'u2' },
    )
    const wsRepo = new EncounterWorkspaceRepository(repo.driveStore)
    const ws = await wsRepo.loadWorkspace(key)
    expect(ws!.audit.events.length).toBeGreaterThanOrEqual(2)
    expect(ws!.metadata.workspaceVersion).toBe(2)
  })

  it('close acta recalcula lifecycle acta_closed', async () => {
    tick = 30
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const acta = sampleActa()
    const key = keyFromDocument(acta)
    await repo.save(acta, { intent: 'draft', savedBy: 'u1' })
    const toClose = await repo.load(key)
    expect(toClose).not.toBeNull()
    const closed = await repo.save(
      { ...toClose!, metadata: { ...toClose!.metadata, status: 'ACTA_CERRADA' } },
      { intent: 'close', expectedDocumentVersion: 1, savedBy: 'u1' },
    )
    expect(closed.ok).toBe(true)
    const ws = await new EncounterWorkspaceRepository(repo.driveStore).loadWorkspace(key)
    expect(ws?.lifecycle.phase).toBe('acta_closed')
    expect(ws?.acta?.status).toBe('ACTA_CERRADA')
  })

  it('probe valid con shell sin acta', async () => {
    const store = createFakeDriveJsonPersistenceRepository().driveStore
    const shell = createEncounterWorkspace({
      key: { category: 'M', phase: 'Fase I', matchId: 'shell|only' },
      encounterNumber: 2,
      grupo: 'G',
      equipoLocal: 'L',
      equipoVisitante: 'V',
      hora: 'h',
      campo: 'c',
      createdBy: 'gas',
    })
    store.injectRawWorkspace(
      { category: 'M', phase: 'Fase I', matchId: 'shell|only' },
      shell,
    )
    const probe = await store.probeDocumentState({
      category: 'M',
      phase: 'Fase I',
      matchId: 'shell|only',
    })
    expect(probe).toBe('valid')
  })

  it('validation failure en atomic replace corrupto', async () => {
    tick = 40
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const store = repo.driveStore
    const key = { category: 'M' as const, phase: 'Fase I' as const, matchId: 'bad|doc' }
    store.injectCorruptOfficial(key, 'ENC_WS_Fase1_Encuentro99', '{not-json')
    const wsRepo = new EncounterWorkspaceRepository(store)
    await expect(wsRepo.loadWorkspace(key)).resolves.toBeNull()
    expect(await store.probeDocumentState(key)).toBe('corrupt')
  })
})
