import { describe, expect, it } from 'vitest'
import { hydrateMatchReportFromActaDocument } from '../adapters/actaHydration.adapter'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import type { ActaDocumentMetadata, ActaDocumentV1, ActaMatchKey } from '../contracts'
import {
  ActaPersistenceError,
  cloneDocument,
  createInMemoryActaRepository,
  keyFromDocument,
} from '../infra/inMemoryActaRepository'
import { emptyMatchReport } from './fixtures'

const FIXED_NOW = '2026-05-21T14:00:00.000Z'
let tick = 0
function now(): string {
  tick += 1
  return `2026-05-21T14:00:${String(tick).padStart(2, '0')}.000Z`
}

function baseMetadata(overrides: Partial<ActaDocumentMetadata> = {}): ActaDocumentMetadata {
  return {
    schemaVersion: 1,
    documentVersion: 1,
    status: 'ACTA_EN_CURSO',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  }
}

function buildSampleDocument(status: ActaDocumentMetadata['status'] = 'ACTA_EN_CURSO'): ActaDocumentV1 {
  const report = emptyMatchReport()
  return projectMatchReportToActaDocument({
    metadata: baseMetadata({ status }),
    report,
    encounterNumber: 14,
    documentName: buildActaDocumentName('Fase I', 14),
  })
}

function matchKeyFromDoc(doc: ActaDocumentV1): ActaMatchKey {
  return keyFromDocument(doc)
}

describe('InMemoryActaRepository', () => {
  it('1. create acta — NO_EXISTE → ACTA_EN_CURSO', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument()
    const key = matchKeyFromDoc(doc)

    expect(await repo.resolveLifecycle(key)).toBe('NO_EXISTE')

    const result = await repo.save(doc, { intent: 'draft', savedBy: 'user1' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.documentVersion).toBe(1)

    expect(await repo.resolveLifecycle(key)).toBe('ACTA_EN_CURSO')
    const loaded = await repo.load(key)
    expect(loaded?.metadata.documentVersion).toBe(1)
    expect(loaded?.metadata.createdBy).toBe('user1')
    expect(loaded?.metadata.status).toBe('ACTA_EN_CURSO')
  })

  it('2. update acta — incrementa documentVersion', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument()
    const key = matchKeyFromDoc(doc)

    await repo.save(doc, { intent: 'draft', savedBy: 'u1' })
    const loaded = (await repo.load(key))!
    const updated = cloneDocument(loaded)
    updated.scoring.score = { local: 7, visitante: 0 }

    const result = await repo.save(updated, {
      intent: 'draft',
      expectedDocumentVersion: 1,
      savedBy: 'u2',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.documentVersion).toBe(2)

    const after = await repo.load(key)
    expect(after?.metadata.documentVersion).toBe(2)
    expect(after?.metadata.lastSavedBy).toBe('u2')
    expect(after?.scoring.score.local).toBe(7)
  })

  it('3. close acta — ACTA_EN_CURSO → ACTA_CERRADA', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument()
    const key = matchKeyFromDoc(doc)

    await repo.save(doc, { intent: 'draft', savedBy: 'u1' })
    const open = (await repo.load(key))!

    const result = await repo.save(open, {
      intent: 'close',
      expectedDocumentVersion: 1,
      savedBy: 'closer',
    })
    expect(result.ok).toBe(true)

    expect(await repo.resolveLifecycle(key)).toBe('ACTA_CERRADA')
    const closed = await repo.load(key)
    expect(closed?.metadata.status).toBe('ACTA_CERRADA')
    expect(closed?.metadata.closedAt).toBeDefined()
    expect(closed?.metadata.closedBy).toBe('closer')
  })

  it('4. reopen acta — ACTA_CERRADA → ACTA_EN_CURSO con auditoría', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument()
    const key = matchKeyFromDoc(doc)

    await repo.save(doc, { intent: 'draft' })
    const open = (await repo.load(key))!
    await repo.save(open, { intent: 'close', expectedDocumentVersion: 1, savedBy: 'c1' })

    const reopened = await repo.reopen(key, {
      reopenedBy: 'staff@lcv',
      reopenReason: 'Corrección marcador',
    })

    expect(reopened.metadata.status).toBe('ACTA_EN_CURSO')
    expect(reopened.metadata.reopenedBy).toBe('staff@lcv')
    expect(reopened.metadata.reopenReason).toBe('Corrección marcador')
    expect(reopened.metadata.closedAt).toBeDefined()
    expect(reopened.metadata.documentVersion).toBe(3)

    const hydrated = hydrateMatchReportFromActaDocument(reopened)
    expect(hydrated.cerrada).toBe(false)
  })

  it('5. stale version conflict — DOCUMENT_VERSION_CONFLICT', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument()
    const key = matchKeyFromDoc(doc)

    await repo.save(doc, { intent: 'draft' })
    const loaded = (await repo.load(key))!

    const result = await repo.save(loaded, {
      intent: 'draft',
      expectedDocumentVersion: 99,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('DOCUMENT_VERSION_CONFLICT')
  })

  it('6. invalid lifecycle transition — cerrar acta ya cerrada', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument()
    const key = matchKeyFromDoc(doc)

    await repo.save(doc, { intent: 'draft' })
    const open = (await repo.load(key))!
    await repo.save(open, { intent: 'close', expectedDocumentVersion: 1 })

    const closed = (await repo.load(key))!
    const again = await repo.save(closed, { intent: 'close', expectedDocumentVersion: 2 })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.code).toBe('LIFECYCLE_VIOLATION')
  })

  it('7. invalid document rejection — create duplicado', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument()
    const key = matchKeyFromDoc(doc)

    await repo.save(doc, { intent: 'draft' })
    const dup = await repo.save(doc, { intent: 'draft' })
    expect(dup.ok).toBe(false)
    if (!dup.ok) expect(dup.code).toBe('ALREADY_EXISTS')
  })

  it('8. load corrupt document — CORRUPT_DOCUMENT', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument('ACTA_CERRADA')
    const key = matchKeyFromDoc(doc)

    repo.injectRawDocument(key, doc)

    await expect(repo.load(key)).rejects.toMatchObject({
      code: 'CORRUPT_DOCUMENT',
    } satisfies Partial<ActaPersistenceError>)
  })

  it('9. freeze closed acta — save draft rechazado', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument()
    const key = matchKeyFromDoc(doc)

    await repo.save(doc, { intent: 'draft' })
    const open = (await repo.load(key))!
    await repo.save(open, { intent: 'close', expectedDocumentVersion: 1 })

    const closed = (await repo.load(key))!
    const frozen = await repo.save(closed, {
      intent: 'draft',
      expectedDocumentVersion: 2,
    })
    expect(frozen.ok).toBe(false)
    if (!frozen.ok) expect(frozen.code).toBe('LIFECYCLE_VIOLATION')
  })

  it('10. documentVersion monotonic — 1 → 2 → 3', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument()
    const key = matchKeyFromDoc(doc)

    const v1 = await repo.save(doc, { intent: 'draft' })
    expect(v1.ok && v1.documentVersion).toBe(1)

    let current = (await repo.load(key))!
    const v2 = await repo.save(current, { intent: 'draft', expectedDocumentVersion: 1 })
    expect(v2.ok && v2.documentVersion).toBe(2)

    current = (await repo.load(key))!
    const v3 = await repo.save(current, { intent: 'draft', expectedDocumentVersion: 2 })
    expect(v3.ok && v3.documentVersion).toBe(3)

    const peek = repo.peekCommitted(key)
    expect(peek?.metadata.documentVersion).toBe(3)
  })

  it('simulateCorruptionOnNextLoad falla una vez y recupera tras commit válido', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument()
    const key = matchKeyFromDoc(doc)

    await repo.save(doc, { intent: 'draft' })
    repo.simulateCorruptionOnNextLoad(key)

    await expect(repo.load(key)).rejects.toThrow(ActaPersistenceError)

    const loaded = (await repo.load(key))!
    const ok = await repo.save(loaded, { intent: 'draft', expectedDocumentVersion: 1 })
    expect(ok.ok).toBe(true)
    await expect(repo.load(key)).resolves.toBeTruthy()
  })

  it('load devuelve clone — mutar resultado no afecta almacén', async () => {
    tick = 0
    const repo = createInMemoryActaRepository({ now })
    const doc = buildSampleDocument()
    const key = matchKeyFromDoc(doc)

    await repo.save(doc, { intent: 'draft' })
    const loaded = (await repo.load(key))!
    loaded.scoring.score.local = 999

    const again = await repo.load(key)
    expect(again?.scoring.score.local).toBe(0)
  })
})
