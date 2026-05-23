import { describe, expect, it } from 'vitest'
import type {
  EncounterWorkspaceDocumentV1,
  TeamAlignmentDocumentV1,
} from './encounter-workspace.document'
import {
  deriveAlignmentGate,
  deriveWorkspaceLifecyclePhase,
  validateEncounterWorkspaceDocument,
} from './validateEncounterWorkspaceDocument'

const MATCH_ID = 'G1|LOCAL|VISIT'
const NOW = '2026-05-22T10:00:00.000Z'

function emptyAlignmentTeam(side: 'local' | 'visitante', equipo: string) {
  return {
    side,
    equipo,
    estado: '' as const,
    delegado: '',
    entrenador: '',
    players: [],
    version: 0,
  }
}

type WorkspaceTestOverrides = {
  identity?: Partial<EncounterWorkspaceDocumentV1['identity']>
  metadata?: Partial<EncounterWorkspaceDocumentV1['metadata']>
  lifecycle?: Partial<EncounterWorkspaceDocumentV1['lifecycle']>
  workflow?: Partial<EncounterWorkspaceDocumentV1['workflow']>
  calendarRef?: Partial<EncounterWorkspaceDocumentV1['calendarRef']>
  alignments?: Partial<EncounterWorkspaceDocumentV1['alignments']> & {
    local?: Partial<TeamAlignmentDocumentV1>
    visitante?: Partial<TeamAlignmentDocumentV1>
  }
  officials?: EncounterWorkspaceDocumentV1['officials']
  acta?: EncounterWorkspaceDocumentV1['acta']
  sync?: Partial<EncounterWorkspaceDocumentV1['sync']>
  audit?: Partial<EncounterWorkspaceDocumentV1['audit']>
}

function baseWorkspace(overrides: WorkspaceTestOverrides = {}): EncounterWorkspaceDocumentV1 {
  const alignmentsBase = {
    schemaVersion: 1 as const,
    gate: 'not_started' as const,
    local: emptyAlignmentTeam('local', 'LOCAL'),
    visitante: emptyAlignmentTeam('visitante', 'VISIT'),
  }
  const alignmentsMerged = {
    ...alignmentsBase,
    ...overrides.alignments,
    local: { ...alignmentsBase.local, ...overrides.alignments?.local },
    visitante: { ...alignmentsBase.visitante, ...overrides.alignments?.visitante },
  }
  const derivedGate = deriveAlignmentGate(alignmentsMerged)
  const alignments = {
    ...alignmentsMerged,
    gate: overrides.alignments?.gate ?? derivedGate,
  }

  const doc: EncounterWorkspaceDocumentV1 = {
    identity: {
      matchId: MATCH_ID,
      category: 'M',
      phase: 'Fase I',
      encounter: {
        grupo: 'G1',
        equipoLocal: 'LOCAL',
        equipoVisitante: 'VISIT',
        hora: '10:00',
        campo: 'C1',
        encounterNumber: 14,
      },
      storageKey: `M::Fase I::${MATCH_ID}`,
      documentFileName: 'ENC_WS_FaseI_14',
      ...overrides.identity,
    },
    metadata: {
      schemaVersion: 1,
      workspaceVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
      createdBy: 'gas',
      lastMutationBy: 'gas',
      lastMutationKind: 'WORKSPACE_CREATE',
      ...overrides.metadata,
    },
    lifecycle: {
      phase: 'workspace_created',
      phaseChangedAt: NOW,
      phaseChangedBy: 'gas',
      ...overrides.lifecycle,
    },
    workflow: {
      actaBinding: 'ACTIVE',
      ...overrides.workflow,
    },
    calendarRef: {
      rowKey: {
        grupo: 'G1',
        equipoLocal: 'LOCAL',
        equipoVisitante: 'VISIT',
      },
      ...overrides.calendarRef,
    },
    alignments,
    officials: overrides.officials ?? {},
    acta: overrides.acta !== undefined ? overrides.acta : null,
    sync: { ledger: [], ...overrides.sync },
    audit: { events: [], ...overrides.audit },
  }

  const derived = deriveWorkspaceLifecyclePhase(doc)
  if (!overrides.lifecycle?.phase) {
    return { ...doc, lifecycle: { ...doc.lifecycle, phase: derived } }
  }
  return doc
}

function minimalActa(status: 'ACTA_EN_CURSO' | 'ACTA_CERRADA' = 'ACTA_EN_CURSO') {
  const player = { jugador: 'P1', dorsal: 1, E: 0, T: 0, PC: 0, Tar: 0 }
  const totals = { E: 0, T: 0, PC: 0, Tar: 0 }
  const classification = { P: 0, BO: 0, BD: 0, Total: 0 }
  return {
    sectionRevision: 1,
    status,
    createdAt: NOW,
    updatedAt: NOW,
    localTeam: {
      side: 'local' as const,
      equipo: 'LOCAL',
      delegado: 'd',
      entrenador: 'e',
      players: [player],
      totals,
      observaciones: '',
    },
    awayTeam: {
      side: 'visitante' as const,
      equipo: 'VISIT',
      delegado: 'd',
      entrenador: 'e',
      players: [player],
      totals,
      observaciones: '',
    },
    score: { local: 0, visitante: 0 },
    incidencias: '',
    observacionesLocal: '',
    observacionesVisitante: '',
    classification: { local: classification, visitante: classification },
    ...(status === 'ACTA_CERRADA' ? { closedAt: NOW } : {}),
  }
}

describe('deriveAlignmentGate', () => {
  it('not_started cuando ambos vacíos', () => {
    const doc = baseWorkspace()
    expect(deriveAlignmentGate(doc.alignments)).toBe('not_started')
  })

  it('both_closed cuando ambos C', () => {
    const doc = baseWorkspace({
      alignments: {
        gate: 'both_closed',
        local: { ...emptyAlignmentTeam('local', 'LOCAL'), estado: 'C' },
        visitante: { ...emptyAlignmentTeam('visitante', 'VISIT'), estado: 'C' },
      },
    })
    expect(deriveAlignmentGate(doc.alignments)).toBe('both_closed')
  })

  it('in_progress con un P', () => {
    const doc = baseWorkspace({
      alignments: {
        gate: 'in_progress',
        local: { ...emptyAlignmentTeam('local', 'LOCAL'), estado: 'P' },
      },
    })
    expect(deriveAlignmentGate(doc.alignments)).toBe('in_progress')
  })
})

describe('deriveWorkspaceLifecyclePhase', () => {
  it('workspace_created sin acta ni alineación', () => {
    const doc = baseWorkspace()
    expect(deriveWorkspaceLifecyclePhase(doc)).toBe('workspace_created')
  })

  it('alignment_complete con ambos C', () => {
    const doc = baseWorkspace({
      alignments: {
        gate: 'both_closed',
        local: { ...emptyAlignmentTeam('local', 'LOCAL'), estado: 'C' },
        visitante: { ...emptyAlignmentTeam('visitante', 'VISIT'), estado: 'C' },
      },
    })
    expect(deriveWorkspaceLifecyclePhase(doc)).toBe('alignment_complete')
  })

  it('acta_in_progress con acta en curso', () => {
    const doc = baseWorkspace({
      acta: minimalActa('ACTA_EN_CURSO'),
      lifecycle: { phase: 'acta_in_progress', phaseChangedAt: NOW, phaseChangedBy: 'u' },
    })
    expect(deriveWorkspaceLifecyclePhase(doc)).toBe('acta_in_progress')
  })

  it('acta_closed con acta cerrada', () => {
    const doc = baseWorkspace({
      acta: minimalActa('ACTA_CERRADA'),
      lifecycle: { phase: 'acta_closed', phaseChangedAt: NOW, phaseChangedBy: 'u' },
    })
    expect(deriveWorkspaceLifecyclePhase(doc)).toBe('acta_closed')
  })
})

describe('validateEncounterWorkspaceDocument', () => {
  it('workspace válido mínimo', () => {
    const doc = baseWorkspace()
    const result = validateEncounterWorkspaceDocument(doc, { expectedMatchId: MATCH_ID })
    expect(result.ok).toBe(true)
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0)
    expect(result.derivedLifecycle).toBe('workspace_created')
  })

  it('lifecycle incoherente falla WS-31', () => {
    const doc = baseWorkspace({
      lifecycle: { phase: 'acta_closed', phaseChangedAt: NOW, phaseChangedBy: 'u' },
    })
    const result = validateEncounterWorkspaceDocument(doc)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.code === 'LIFECYCLE_PHASE_MISMATCH')).toBe(true)
  })

  it('acta + officials simultáneos falla WS-36', () => {
    const doc = baseWorkspace({
      acta: minimalActa(),
      officials: { referee: { name: 'Árbitro' } },
      lifecycle: { phase: 'acta_in_progress', phaseChangedAt: NOW, phaseChangedBy: 'u' },
    })
    const result = validateEncounterWorkspaceDocument(doc)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.invariantId === 'WS-36')).toBe(true)
  })

  it('SUPERSEDED editable bloqueado con save_draft WS-30', () => {
    const doc = baseWorkspace({
      workflow: {
        actaBinding: 'SUPERSEDED',
        lastReopen: {
          mode: 'REOPEN_ALIGNMENTS',
          at: NOW,
          by: 'admin',
          fromWorkspaceVersion: 1,
        },
      },
      acta: minimalActa('ACTA_CERRADA'),
      lifecycle: { phase: 'acta_closed', phaseChangedAt: NOW, phaseChangedBy: 'u' },
    })
    const result = validateEncounterWorkspaceDocument(doc, { editIntent: 'save_draft' })
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.code === 'EDIT_WHILE_SUPERSEDED')).toBe(true)
  })

  it('acceptance inválida sin both_closed WS-28', () => {
    const doc = baseWorkspace({
      workflow: {
        actaBinding: 'ACTIVE',
        alignmentAcceptance: { acceptedAt: NOW, acceptedBy: 'arb' },
      },
      alignments: {
        gate: 'in_progress',
        local: { ...emptyAlignmentTeam('local', 'LOCAL'), estado: 'P' },
      },
    })
    const result = validateEncounterWorkspaceDocument(doc)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.code === 'ACCEPTANCE_WITHOUT_BOTH_CLOSED')).toBe(true)
  })

  it('alignments.gate incoherente WS-42', () => {
    const doc = baseWorkspace({
      alignments: {
        gate: 'both_closed',
        local: emptyAlignmentTeam('local', 'LOCAL'),
        visitante: emptyAlignmentTeam('visitante', 'VISIT'),
      },
    })
    const result = validateEncounterWorkspaceDocument(doc)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.code === 'ALIGNMENT_GATE_MISMATCH')).toBe(true)
  })

  it('ledger syncKey duplicada WS-20', () => {
    const keyString = `${MATCH_ID}::v1::close`
    const entry = {
      syncKey: { matchId: MATCH_ID, workspaceVersion: 1, intent: 'close' as const },
      syncKeyString: keyString,
      intent: 'close' as const,
      status: 'SUCCESS' as const,
      retries: 0,
      createdAt: NOW,
      updatedAt: NOW,
    }
    const doc = baseWorkspace({
      acta: minimalActa('ACTA_CERRADA'),
      lifecycle: { phase: 'acta_closed', phaseChangedAt: NOW, phaseChangedBy: 'u' },
      sync: { ledger: [entry, { ...entry }] },
    })
    const result = validateEncounterWorkspaceDocument(doc)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.code === 'SYNC_KEY_DUPLICATE')).toBe(true)
  })

  it('acta cerrada mutable alignments WS-34', () => {
    const doc = baseWorkspace({
      acta: minimalActa('ACTA_CERRADA'),
      lifecycle: { phase: 'acta_closed', phaseChangedAt: NOW, phaseChangedBy: 'u' },
      alignments: {
        gate: 'in_progress',
        local: { ...emptyAlignmentTeam('local', 'LOCAL'), estado: 'P' },
        visitante: { ...emptyAlignmentTeam('visitante', 'VISIT'), estado: 'C' },
      },
    })
    const result = validateEncounterWorkspaceDocument(doc)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.code === 'ALIGNMENTS_NOT_FROZEN')).toBe(true)
  })

  it('officials válido solo pre-acta', () => {
    const doc = baseWorkspace({ officials: { referee: { name: 'Ref' } } })
    const result = validateEncounterWorkspaceDocument(doc)
    expect(result.ok).toBe(true)
  })

  it('SUPERSEDED + acceptance activa WS-29', () => {
    const doc = baseWorkspace({
      workflow: {
        actaBinding: 'SUPERSEDED',
        alignmentAcceptance: { acceptedAt: NOW, acceptedBy: 'arb' },
        lastReopen: {
          mode: 'REOPEN_ALIGNMENTS',
          at: NOW,
          by: 'admin',
          fromWorkspaceVersion: 1,
        },
      },
      alignments: {
        gate: 'both_closed',
        local: { ...emptyAlignmentTeam('local', 'LOCAL'), estado: 'C' },
        visitante: { ...emptyAlignmentTeam('visitante', 'VISIT'), estado: 'C' },
      },
      acta: minimalActa('ACTA_CERRADA'),
      lifecycle: { phase: 'acta_closed', phaseChangedAt: NOW, phaseChangedBy: 'u' },
    })
    const result = validateEncounterWorkspaceDocument(doc)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.code === 'ACCEPTANCE_WITH_SUPERSEDED')).toBe(true)
  })
})
