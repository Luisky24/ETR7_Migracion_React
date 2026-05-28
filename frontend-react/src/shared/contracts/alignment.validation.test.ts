import { describe, expect, it } from 'vitest'
import type { AlignmentDocumentV1 } from './alignment.document'
import { nextCloseRevision } from './alignment.helpers'
import { validateAlignmentDocument } from './validateAlignmentDocument'

const NOW = '2026-05-28T08:00:00.000Z'

function baseAlignment(overrides: Partial<AlignmentDocumentV1> = {}): AlignmentDocumentV1 {
  const identity = {
    categoryId: 'M',
    seasonId: '2026',
    teamId: 'CRAT',
    matchId: 'G1|CRAT|RIVAL',
    phaseId: 'FASE1',
    encounterId: 'J12',
    storageKey: 'M::2026::FASE1::G1|CRAT|RIVAL::CRAT',
    documentFileName: 'ALI_CRAT_FASE1_J12.json',
    ...(overrides.identity ?? {}),
  }
  const doc: AlignmentDocumentV1 = {
    schema: 'AlignmentDocumentV1',
    identity,
    metadata: {
      schemaVersion: 1,
      documentVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
      createdBy: 'test',
      updatedBy: 'test',
      ...(overrides.metadata ?? {}),
    },
    team: {
      teamId: identity.teamId,
      teamCode: 'CRAT',
      roleInMatch: 'LOCAL',
      ...(overrides.team ?? {}),
    },
    match: {
      phaseId: identity.phaseId,
      phaseCode: 'FASE1',
      encounterId: identity.encounterId,
      encounterCode: 'J12',
      matchId: identity.matchId,
      ...(overrides.match ?? {}),
    },
    players: [
      { playerId: 'p1', displayName: 'P1', dorsal: 1 },
      { playerId: 'p2', displayName: 'P2', dorsal: 2 },
    ],
    selection: {
      starters: ['p1'],
      bench: ['p2'],
      captain: 'p1',
      goalkeeper: null,
      ...(overrides.selection ?? {}),
    },
    lifecycle: {
      state: 'IN_PROGRESS',
      history: [{ from: 'DRAFT', to: 'IN_PROGRESS', at: NOW, by: 'test' }],
      ...(overrides.lifecycle ?? {}),
    },
    closure: overrides.closure,
    audit: { events: [], ...(overrides.audit ?? {}) },
    sync: { ...(overrides.sync ?? {}) },
    integrity: overrides.integrity,
  }
  return { ...doc, ...overrides }
}

describe('nextCloseRevision', () => {
  it('inicia en 1 si no hay cierre previo', () => {
    const doc = baseAlignment({ closure: undefined })
    expect(nextCloseRevision(doc)).toBe(1)
  })

  it('incrementa desde cierre previo', () => {
    const doc = baseAlignment({
      closure: {
        closedAt: NOW,
        closedBy: 'd',
        closeRevision: 2,
        snapshot: { players: [], selection: { starters: [], bench: [], captain: null, goalkeeper: null } },
      },
    })
    expect(nextCloseRevision(doc)).toBe(3)
  })
})

describe('validateAlignmentDocument', () => {
  it('documento válido mínimo', () => {
    const doc = baseAlignment()
    const res = validateAlignmentDocument(doc, { expectedMatchId: doc.identity.matchId, expectedDocumentVersion: 1 })
    expect(res.ok).toBe(true)
    expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0)
  })

  it('documentVersion inválido falla', () => {
    const doc = baseAlignment({ metadata: { documentVersion: 0 } as AlignmentDocumentV1['metadata'] })
    const res = validateAlignmentDocument(doc)
    expect(res.ok).toBe(false)
    expect(res.issues.some((i) => i.code === 'DOCUMENT_VERSION_INVALID')).toBe(true)
  })

  it('storageKey incoherente falla', () => {
    const doc = baseAlignment({ identity: { storageKey: 'WRONG' } as AlignmentDocumentV1['identity'] })
    const res = validateAlignmentDocument(doc)
    expect(res.ok).toBe(false)
    expect(res.issues.some((i) => i.code === 'STORAGE_KEY_MISMATCH')).toBe(true)
  })

  it('REOPENED sin CLOSED previo falla', () => {
    const doc = baseAlignment({
      lifecycle: {
        state: 'REOPENED',
        history: [{ from: 'IN_PROGRESS', to: 'REOPENED', at: NOW, by: 'u', reason: 'x' }],
      },
    })
    const res = validateAlignmentDocument(doc)
    expect(res.ok).toBe(false)
    expect(res.issues.some((i) => i.code === 'REOPENED_WITHOUT_CLOSED')).toBe(true)
  })

  it('CLOSED sin closure falla', () => {
    const doc = baseAlignment({
      lifecycle: { state: 'CLOSED', history: [{ from: 'IN_PROGRESS', to: 'CLOSED', at: NOW, by: 'd' }] },
      closure: undefined,
    })
    const res = validateAlignmentDocument(doc)
    expect(res.ok).toBe(false)
    expect(res.issues.some((i) => i.code === 'CLOSED_REQUIRES_CLOSURE')).toBe(true)
  })

  it('CLOSED con root!=snapshot falla ALI-12', () => {
    const snapshotPlayers = [
      { playerId: 'p1', displayName: 'P1', dorsal: 1 },
      { playerId: 'p2', displayName: 'P2', dorsal: 2 },
    ] as const
    const doc = baseAlignment({
      lifecycle: { state: 'CLOSED', history: [{ from: 'IN_PROGRESS', to: 'CLOSED', at: NOW, by: 'd' }] },
      closure: {
        closedAt: NOW,
        closedBy: 'd',
        closeRevision: 1,
        snapshot: {
          players: snapshotPlayers,
          selection: { starters: ['p1'], bench: ['p2'], captain: 'p1', goalkeeper: null },
        },
      },
      selection: { starters: ['p2'], bench: ['p1'], captain: 'p2', goalkeeper: null },
    })
    const res = validateAlignmentDocument(doc)
    expect(res.ok).toBe(false)
    expect(res.issues.some((i) => i.code === 'ROOT_SELECTION_MISMATCH')).toBe(true)
  })

  it('reopen requiere reason + audit event', () => {
    const doc = baseAlignment({
      lifecycle: {
        state: 'REOPENED',
        history: [
          { from: 'IN_PROGRESS', to: 'CLOSED', at: NOW, by: 'd' },
          { from: 'CLOSED', to: 'REOPENED', at: NOW, by: 'd', reason: 'acta active' },
        ],
      },
      audit: { events: [] },
    })
    const res = validateAlignmentDocument(doc)
    expect(res.ok).toBe(false)
    expect(res.issues.some((i) => i.code === 'REOPEN_AUDIT_REQUIRED')).toBe(true)
  })

  it('audit append-only (at no decreciente) falla si desordenado', () => {
    const doc = baseAlignment({
      audit: {
        events: [
          { at: '2026-05-28T09:00:00.000Z', by: 'u', kind: 'ALIGNMENT_EDIT' },
          { at: '2026-05-28T08:00:00.000Z', by: 'u', kind: 'ALIGNMENT_EDIT' },
        ],
      },
    })
    const res = validateAlignmentDocument(doc)
    expect(res.ok).toBe(false)
    expect(res.issues.some((i) => i.code === 'AUDIT_NOT_APPEND_ORDER')).toBe(true)
  })
})

