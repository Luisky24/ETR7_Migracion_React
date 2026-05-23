import { describe, expect, it } from 'vitest'
import { hydrateMatchReportFromActaDocument } from '../adapters/actaHydration.adapter'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import type { ActaDocumentV1, ActaDocumentMetadata } from '../contracts'
import {
  assertLifecycleTransition,
  canClose,
  canReopen,
  validateActaDocument,
} from '../persistence'
import { emptyMatchReport } from './fixtures'

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

function sampleDocument(status: ActaDocumentMetadata['status'] = 'ACTA_EN_CURSO'): ActaDocumentV1 {
  const report = emptyMatchReport()
  return projectMatchReportToActaDocument({
    metadata: baseMetadata({ status }),
    report,
    encounterNumber: 14,
    documentName: buildActaDocumentName('Fase I', 14),
  })
}

describe('persistence lifecycleRules', () => {
  it('permite cerrar solo desde ACTA_EN_CURSO', () => {
    expect(canClose('ACTA_EN_CURSO')).toBe(true)
    expect(canClose('ACTA_CERRADA')).toBe(false)
    expect(canReopen('ACTA_CERRADA')).toBe(true)
  })

  it('assertLifecycleTransition lanza en transición inválida', () => {
    expect(() => assertLifecycleTransition('ACTA_CERRADA', 'CLOSE')).toThrow()
    expect(() => assertLifecycleTransition('NO_EXISTE', 'REOPEN')).toThrow()
    expect(() => assertLifecycleTransition('NO_EXISTE', 'FIRST_SAVE')).not.toThrow()
  })
})

describe('persistence documentValidators', () => {
  it('valida documento coherente', () => {
    const doc = sampleDocument()
    const result = validateActaDocument(doc)
    expect(result.ok).toBe(true)
  })

  it('rechaza ACTA_CERRADA sin closedAt', () => {
    const doc = sampleDocument('ACTA_CERRADA')
    const result = validateActaDocument(doc)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.invariantId === 'F8')).toBe(true)
  })

  it('detecta conflicto de documentVersion', () => {
    const doc = sampleDocument()
    const result = validateActaDocument(doc, { expectedDocumentVersion: 99 })
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.invariantId === 'F5')).toBe(true)
  })
})

describe('acta projection / hydration adapters', () => {
  it('round-trip preserva classification en ACTA_CERRADA sin recálculo', () => {
    const report = emptyMatchReport()
    const closedMeta = baseMetadata({
      status: 'ACTA_CERRADA',
      closedAt: '2026-05-21T13:00:00.000Z',
      closedBy: 'staff@test',
    })
    const doc = projectMatchReportToActaDocument({
      metadata: closedMeta,
      report: {
        ...report,
        local: {
          ...report.local,
          classification: { P: 3, BO: 0, BD: 0, Total: 3 },
        },
      },
      encounterNumber: 1,
      documentName: 'ACT_Fase1_Encuentro1',
    })
    const hydrated = hydrateMatchReportFromActaDocument(doc)
    expect(hydrated.cerrada).toBe(true)
    expect(hydrated.local.classification.Total).toBe(3)
  })

  it('buildActaDocumentName sigue convención acordada', () => {
    expect(buildActaDocumentName('Fase II', 7)).toBe('ACT_Fase2_Encuentro7')
  })
})
