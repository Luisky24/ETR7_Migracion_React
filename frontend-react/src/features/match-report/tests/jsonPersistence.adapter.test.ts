import { describe, expect, it } from 'vitest'
import {
  backupFileName,
  officialFileName,
  previousFileName,
  tmpFileName,
} from '../persistence/actaRepositoryKeys'
import {
  atomicReplaceDocumentInMap,
  safeParseJson,
} from '../infra/actaDriveFilePipeline'
import { ActaPersistenceError } from '../infra/jsonPersistence.adapter'
import { createFakeDriveJsonPersistenceRepository } from '../infra/jsonPersistence.adapter'
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
  return `2026-05-21T15:00:${String(tick).padStart(2, '0')}.000Z`
}

function baseMetadata(overrides: Partial<ActaDocumentMetadata> = {}): ActaDocumentMetadata {
  return {
    schemaVersion: 1,
    documentVersion: 1,
    status: 'ACTA_EN_CURSO',
    createdAt: '2026-05-21T12:00:00.000Z',
    updatedAt: '2026-05-21T12:00:00.000Z',
    ...overrides,
  }
}

function sampleDoc(status: ActaDocumentMetadata['status'] = 'ACTA_EN_CURSO') {
  const report = emptyMatchReport()
  return projectMatchReportToActaDocument({
    metadata: baseMetadata({ status }),
    report,
    encounterNumber: 14,
    documentName: buildActaDocumentName('Fase I', 14),
  })
}

describe('actaDriveFilePipeline', () => {
  it('tmp replace flow genera backup y previous', () => {
    const files = new Map<string, { content: string }>()
    const name = 'ACT_Fase1_Encuentro1'
    const v1 = JSON.stringify({ match: { matchId: 'x' }, metadata: { status: 'ACTA_EN_CURSO' } })
    atomicReplaceDocumentInMap(files, name, v1)
    const v2 = JSON.stringify({ match: { matchId: 'x' }, metadata: { status: 'ACTA_EN_CURSO', v: 2 } })
    const result = atomicReplaceDocumentInMap(files, name, v2)
    expect(result.ok).toBe(true)
    expect(files.get(officialFileName(name))?.content).toBe(v2)
    expect(files.get(backupFileName(name))?.content).toBe(v1)
    expect(files.get(previousFileName(name))?.content).toBe(v1)
    expect(files.has(tmpFileName(name))).toBe(false)
  })

  it('detecta json corrupto en tmp', () => {
    const files = new Map<string, { content: string }>()
    const result = atomicReplaceDocumentInMap(files, 'ACT_X', '{invalid')
    expect(result.ok).toBe(false)
    expect(result.code).toBe('VALIDATION_FAILED')
  })
})

describe('JsonPersistenceRepository (FakeDrive)', () => {
  it('1. create real document', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const doc = sampleDoc()
    const key = keyFromDocument(doc)
    const res = await repo.save(doc, { intent: 'draft', savedBy: 'u1' })
    expect(res.ok).toBe(true)
    expect(await repo.resolveLifecycle(key)).toBe('ACTA_EN_CURSO')
    const loaded = (await repo.load(key))!
    expect(repo.driveStore.getFiles().has(officialFileName(loaded.match.documentName))).toBe(true)
    expect(loaded.match.documentName).toMatch(/^ENC_WS_/)
  })

  it('2. update existing', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const doc = sampleDoc()
    const key = keyFromDocument(doc)
    await repo.save(doc, { intent: 'draft' })
    const loaded = (await repo.load(key))!
    loaded.scoring.score = { local: 5, visitante: 0 }
    const res = await repo.save(loaded, { intent: 'draft', expectedDocumentVersion: 1 })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.documentVersion).toBe(2)
  })

  it('3. close lifecycle', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const doc = sampleDoc()
    const key = keyFromDocument(doc)
    await repo.save(doc, { intent: 'draft' })
    const open = (await repo.load(key))!
    const res = await repo.save(open, { intent: 'close', expectedDocumentVersion: 1, savedBy: 'c' })
    expect(res.ok).toBe(true)
    expect(await repo.resolveLifecycle(key)).toBe('ACTA_CERRADA')
  })

  it('4. reopen lifecycle', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const doc = sampleDoc()
    const key = keyFromDocument(doc)
    await repo.save(doc, { intent: 'draft' })
    const open = (await repo.load(key))!
    await repo.save(open, { intent: 'close', expectedDocumentVersion: 1 })
    const reopened = await repo.reopen(key, { reopenedBy: 'admin', reopenReason: 'fix' })
    expect(reopened.metadata.status).toBe('ACTA_EN_CURSO')
    expect(reopened.metadata.reopenedBy).toBe('admin')
  })

  it('5. version conflict', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const doc = sampleDoc()
    const key = keyFromDocument(doc)
    await repo.save(doc, { intent: 'draft' })
    const loaded = (await repo.load(key))!
    const res = await repo.save(loaded, { intent: 'draft', expectedDocumentVersion: 99 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('DOCUMENT_VERSION_CONFLICT')
  })

  it('7. invalid schema rejection — closed sin closedAt en inject', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const doc = sampleDoc('ACTA_CERRADA')
    const key = keyFromDocument(doc)
    repo.driveStore.injectCorruptOfficial(key, doc.match.documentName, JSON.stringify(doc))
    await expect(repo.load(key)).rejects.toMatchObject({ code: 'CORRUPT_DOCUMENT' })
  })

  it('8. corrupt json detection', () => {
    expect(safeParseJson('{no').ok).toBe(false)
  })

  it('9. backup generation on update', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const doc = sampleDoc()
    const key = keyFromDocument(doc)
    await repo.save(doc, { intent: 'draft' })
    const loadedAfterCreate = (await repo.load(key))!
    const name = loadedAfterCreate.match.documentName
    const v1 = repo.driveStore.getFiles().get(officialFileName(name))!.content
    const loaded = (await repo.load(key))!
    await repo.save(loaded, { intent: 'draft', expectedDocumentVersion: 1 })
    expect(repo.driveStore.getFiles().get(backupFileName(name))?.content).toBe(v1)
  })

  it('10. load validation', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const doc = sampleDoc()
    const key = keyFromDocument(doc)
    await repo.save(doc, { intent: 'draft' })
    const loaded = await repo.load(key)
    expect(loaded?.metadata.documentVersion).toBe(1)
  })

  it('11. freeze closed acta', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const doc = sampleDoc()
    const key = keyFromDocument(doc)
    await repo.save(doc, { intent: 'draft' })
    const open = (await repo.load(key))!
    await repo.save(open, { intent: 'close', expectedDocumentVersion: 1 })
    const closed = (await repo.load(key))!
    const res = await repo.save(closed, { intent: 'draft', expectedDocumentVersion: 2 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('LIFECYCLE_VIOLATION')
  })

  it('12. atomic replace failure recovery', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const doc = sampleDoc()
    const key = keyFromDocument(doc)
    await repo.save(doc, { intent: 'draft' })
    const loaded = (await repo.load(key))!
    repo.driveStore.simulateAtomicReplaceFailure()
    const fail = await repo.save(loaded, { intent: 'draft', expectedDocumentVersion: 1 })
    expect(fail.ok).toBe(false)
    if (!fail.ok) expect(fail.code).toBe('IO_FAILURE')
    const still = await repo.load(key)
    expect(still?.metadata.documentVersion).toBe(1)
  })

  it('documentVersion monotonic', async () => {
    tick = 0
    const repo = createFakeDriveJsonPersistenceRepository({ now })
    const doc = sampleDoc()
    const key = keyFromDocument(doc)
    await repo.save(doc, { intent: 'draft' })
    let cur = (await repo.load(key))!
    await repo.save(cur, { intent: 'draft', expectedDocumentVersion: 1 })
    cur = (await repo.load(key))!
    await repo.save(cur, { intent: 'draft', expectedDocumentVersion: 2 })
    cur = (await repo.load(key))!
    expect(cur.metadata.documentVersion).toBe(3)
  })
})

describe('ActaPersistenceError', () => {
  it('expone code tipado', () => {
    const err = new ActaPersistenceError('CORRUPT_DOCUMENT', 'test')
    expect(err.code).toBe('CORRUPT_DOCUMENT')
  })
})
