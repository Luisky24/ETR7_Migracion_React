import { describe, expect, it } from 'vitest'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import type { ActaDocumentMetadata } from '../contracts'
import { validateActaDocument } from '../persistence/documentValidators'
import {
  buildCompositeEncounterState,
  buildLastReopenAudit,
  defaultEncounterWorkflow,
  getActaBinding,
  isDocumentFrozen,
  shouldHydrateFromJsonDocument,
  validateCompositeEncounterState,
} from '../utils/encounterWorkflow'
import { baseContext, emptyMatchReport } from './fixtures'

function baseMetadata(overrides: Partial<ActaDocumentMetadata> = {}): ActaDocumentMetadata {
  const now = '2026-05-21T12:00:00.000Z'
  return {
    schemaVersion: 1,
    documentVersion: 1,
    status: 'ACTA_EN_CURSO',
    createdAt: now,
    updatedAt: now,
    encounterWorkflow: defaultEncounterWorkflow(),
    ...overrides,
  }
}

describe('encounterWorkflow', () => {
  it('1. ACTIVE permite hidratar JSON', () => {
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata(),
      report: emptyMatchReport(),
      encounterNumber: 1,
      documentName: buildActaDocumentName('Fase I', 1),
    })
    expect(shouldHydrateFromJsonDocument(doc)).toBe(true)
    expect(getActaBinding(doc)).toBe('ACTIVE')
  })

  it('2. SUPERSEDED no hidrata — bootstrap legacy', () => {
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata({
        status: 'ACTA_CERRADA',
        closedAt: '2026-05-21T13:00:00.000Z',
        encounterWorkflow: {
          actaBinding: 'SUPERSEDED',
          lastReopen: buildLastReopenAudit({
            mode: 'REOPEN_ALIGNMENTS',
            at: '2026-05-21T14:00:00.000Z',
            by: 'admin',
            fromDocumentVersion: 2,
            alcance: 'A',
          }),
        },
      }),
      report: emptyMatchReport(),
      encounterNumber: 2,
      documentName: buildActaDocumentName('Fase I', 2),
    })
    expect(shouldHydrateFromJsonDocument(doc)).toBe(false)
    const validation = validateActaDocument(doc)
    expect(validation.ok).toBe(true)
  })

  it('3. reopen modes válidos en metadata', () => {
    const reopenActa = baseMetadata({
      status: 'ACTA_EN_CURSO',
      reopenedAt: '2026-05-21T14:00:00.000Z',
      reopenedBy: 'staff',
      encounterWorkflow: {
        actaBinding: 'ACTIVE',
        lastReopen: buildLastReopenAudit({
          mode: 'REOPEN_ACTA',
          at: '2026-05-21T14:00:00.000Z',
          by: 'staff',
          fromDocumentVersion: 2,
        }),
      },
    })
    expect(validateActaDocument(projectDoc(reopenActa)).ok).toBe(true)

    const reopenAlign = baseMetadata({
      status: 'ACTA_CERRADA',
      closedAt: '2026-05-21T13:00:00.000Z',
      encounterWorkflow: {
        actaBinding: 'SUPERSEDED',
        lastReopen: buildLastReopenAudit({
          mode: 'REOPEN_ALIGNMENTS',
          at: '2026-05-21T15:00:00.000Z',
          by: 'admin',
          fromDocumentVersion: 3,
          alcance: 'L',
        }),
      },
    })
    expect(validateActaDocument(projectDoc(reopenAlign)).ok).toBe(true)
  })

  it('4. binding consistency — REOPEN_ALIGNMENTS requiere SUPERSEDED', () => {
    const bad = baseMetadata({
      encounterWorkflow: {
        actaBinding: 'ACTIVE',
        lastReopen: buildLastReopenAudit({
          mode: 'REOPEN_ALIGNMENTS',
          at: '2026-05-21T14:00:00.000Z',
          by: 'admin',
          fromDocumentVersion: 1,
        }),
      },
    })
    const validation = validateActaDocument(projectDoc(bad))
    expect(validation.ok).toBe(false)
  })

  it('freeze deriva de ACTA_CERRADA no de binding', () => {
    expect(isDocumentFrozen('ACTA_CERRADA')).toBe(true)
    expect(isDocumentFrozen('ACTA_EN_CURSO')).toBe(false)
  })

  it('composite state — SUPERSEDED vs acta_abierta inválido', () => {
    const doc = projectMatchReportToActaDocument({
      metadata: baseMetadata({
        status: 'ACTA_CERRADA',
        encounterWorkflow: { actaBinding: 'SUPERSEDED' },
      }),
      report: emptyMatchReport(),
      encounterNumber: 3,
      documentName: buildActaDocumentName('Fase I', 3),
    })
    const composite = buildCompositeEncounterState(doc, 'acta_abierta')
    expect(validateCompositeEncounterState(composite).ok).toBe(false)
  })
})

function projectDoc(metadata: ActaDocumentMetadata) {
  return projectMatchReportToActaDocument({
    metadata,
    report: emptyMatchReport(baseContext()),
    encounterNumber: 9,
    documentName: buildActaDocumentName('Fase I', 9),
  })
}
