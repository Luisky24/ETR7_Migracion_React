import { describe, expect, it } from 'vitest'
import type {
  EncounterWorkspaceDocumentV1,
  TeamAlignmentDocumentV1,
  WorkspaceAlignmentRefV1,
} from '@/shared/contracts/encounter-workspace.document'
import type { AlignmentSnapshotV1 } from '@/shared/contracts/alignment.document'
import { deriveAlignmentGate } from '@/shared/contracts/validateEncounterWorkspaceDocument'
import { computeRuntimeReconcile } from './runtimeReconcileDiagnostics'

const MATCH_ID = 'G1|LOCAL|VISIT'
const STORAGE_LOCAL = 'M::2025::Fase I::G1|LOCAL|VISIT::LOCAL'
const STORAGE_VISIT = 'M::2025::Fase I::G1|LOCAL|VISIT::VISIT'

function emptyTeam(side: 'local' | 'visitante', equipo: string): TeamAlignmentDocumentV1 {
  return {
    side,
    equipo,
    estado: '',
    delegado: '',
    entrenador: '',
    players: [],
    version: 0,
  }
}

function snapshotWithPlayer(playerId: string, dorsal: number, titular: boolean): AlignmentSnapshotV1 {
  return {
    players: [{ playerId, displayName: 'Jugador', dorsal }],
    selection: {
      starters: titular ? [playerId] : [],
      bench: titular ? [] : [playerId],
      captain: playerId,
    },
  }
}

function closedRef(
  overrides: Partial<WorkspaceAlignmentRefV1> & { snapshot?: AlignmentSnapshotV1 } = {},
): WorkspaceAlignmentRefV1 {
  const snapshot = overrides.snapshot ?? snapshotWithPlayer('p1', 9, true)
  return {
    storageKey: STORAGE_LOCAL,
    documentVersion: 2,
    closeRevision: 1,
    lifecycle: 'CLOSED',
    closedAt: '2026-05-22T10:00:00.000Z',
    closedBy: 'test',
    snapshot,
    ...overrides,
  }
}

type WorkspaceOverrides = {
  alignments?: {
    gate?: EncounterWorkspaceDocumentV1['alignments']['gate']
    local?: Partial<TeamAlignmentDocumentV1>
    visitante?: Partial<TeamAlignmentDocumentV1>
  }
  workflow?: Partial<EncounterWorkspaceDocumentV1['workflow']>
  metadata?: Partial<EncounterWorkspaceDocumentV1['metadata']>
}

function workspace(overrides: WorkspaceOverrides = {}): EncounterWorkspaceDocumentV1 {
  const localBase = emptyTeam('local', 'LOCAL')
  const visitanteBase = emptyTeam('visitante', 'VISIT')
  const alignmentsMerged = {
    schemaVersion: 1 as const,
    gate: 'not_started' as const,
    local: { ...localBase, ...overrides.alignments?.local },
    visitante: { ...visitanteBase, ...overrides.alignments?.visitante },
  }
  const gate = overrides.alignments?.gate ?? deriveAlignmentGate(alignmentsMerged)
  return {
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
      documentFileName: 'ENC_WS',
    },
    metadata: {
      schemaVersion: 1,
      workspaceVersion: 3,
      createdAt: '2026-05-22T10:00:00.000Z',
      updatedAt: '2026-05-22T10:00:00.000Z',
      createdBy: 'test',
      lastMutationBy: 'test',
      lastMutationKind: 'WORKSPACE_CREATE',
      ...overrides.metadata,
    },
    lifecycle: {
      phase: 'alignment_in_progress',
      phaseChangedAt: '2026-05-22T10:00:00.000Z',
      phaseChangedBy: 'test',
    },
    workflow: { actaBinding: 'ACTIVE', ...overrides.workflow },
    calendarRef: { rowKey: { grupo: 'G1', equipoLocal: 'LOCAL', equipoVisitante: 'VISIT' } },
    alignments: { ...alignmentsMerged, gate },
    officials: {},
    acta: null,
    sync: { ledger: [] },
    audit: { events: [] },
  }
}

describe('A4.1.2 runtimeReconcileDiagnostics', () => {
  it('ok vacío cuando workspace coherente sin refs cerrados', () => {
    const result = computeRuntimeReconcile({ workspace: workspace() })
    expect(result.ok).toBe(true)
    expect(result.findings).toHaveLength(0)
    expect(result.matchId).toBe(MATCH_ID)
  })

  it('WORKSPACE_ALIGNMENT_REF_MISSING cuando equipo cerrado sin ref', () => {
    const result = computeRuntimeReconcile({
      workspace: workspace({
        alignments: {
          local: { estado: 'C', version: 1, players: [{ playerId: 'p1', jugador: 'A', dorsal: 1, titular: true, suplente: false, capitan: true }] },
        },
      }),
    })
    expect(result.ok).toBe(false)
    expect(result.findings.some((f) => f.code === 'WORKSPACE_ALIGNMENT_REF_MISSING' && f.side === 'local')).toBe(
      true,
    )
  })

  it('WORKSPACE_ALIGNMENT_SNAPSHOT_MISSING cuando ref sin players en snapshot', () => {
    const ref = closedRef({ snapshot: { players: [], selection: { starters: [], bench: [], captain: '' } } })
    const result = computeRuntimeReconcile({
      workspace: workspace({
        alignments: {
          local: {
            estado: 'C',
            version: ref.documentVersion,
            alignmentRef: ref,
            players: [{ playerId: 'p1', jugador: 'A', dorsal: 9, titular: true, suplente: false, capitan: true }],
          },
        },
      }),
    })
    expect(result.findings.some((f) => f.code === 'WORKSPACE_ALIGNMENT_SNAPSHOT_MISSING')).toBe(true)
  })

  it('ALIGNMENT_STALE_SNAPSHOT cuando players materializados difieren del snapshot', () => {
    const ref = closedRef({ snapshot: snapshotWithPlayer('p1', 9, true) })
    const result = computeRuntimeReconcile({
      workspace: workspace({
        alignments: {
          local: {
            estado: 'C',
            version: ref.documentVersion,
            alignmentRef: ref,
            players: [{ playerId: 'p1', jugador: 'A', dorsal: 99, titular: true, suplente: false, capitan: true }],
          },
        },
      }),
    })
    expect(result.findings.some((f) => f.code === 'ALIGNMENT_STALE_SNAPSHOT')).toBe(true)
    expect(result.findings.some((f) => f.code === 'ALIGNMENT_CLOSE_REVISION_MISMATCH')).toBe(true)
  })

  it('ALIGNMENT_DOCUMENT_VERSION_MISMATCH cuando team.version ≠ ref.documentVersion', () => {
    const ref = closedRef()
    const result = computeRuntimeReconcile({
      workspace: workspace({
        alignments: {
          local: {
            estado: 'C',
            version: 99,
            alignmentRef: ref,
            players: [{ playerId: 'p1', jugador: 'A', dorsal: 9, titular: true, suplente: false, capitan: true }],
          },
        },
      }),
    })
    expect(result.findings.some((f) => f.code === 'ALIGNMENT_DOCUMENT_VERSION_MISMATCH')).toBe(true)
  })

  it('WORKSPACE_ALIGNMENT_LIFECYCLE_INVALID cuando ref REOPENED y equipo cerrado', () => {
    const ref = closedRef({ lifecycle: 'REOPENED', storageKey: STORAGE_VISIT })
    const result = computeRuntimeReconcile({
      workspace: workspace({
        alignments: {
          visitante: {
            estado: 'C',
            version: ref.documentVersion,
            alignmentRef: ref,
            players: [{ playerId: 'p1', jugador: 'A', dorsal: 9, titular: true, suplente: false, capitan: true }],
          },
        },
      }),
    })
    expect(result.findings.some((f) => f.code === 'WORKSPACE_ALIGNMENT_LIFECYCLE_INVALID')).toBe(true)
  })

  it('WORKSPACE_SUPERSEDED cuando actaBinding es SUPERSEDED', () => {
    const result = computeRuntimeReconcile({
      workspace: workspace({ workflow: { actaBinding: 'SUPERSEDED' } }),
    })
    expect(result.findings.some((f) => f.code === 'WORKSPACE_SUPERSEDED')).toBe(true)
    expect(result.binding.workspaceActaBinding).toBe('SUPERSEDED')
  })

  it('WORKSPACE_GATE_MISMATCH cuando gate no coincide con estados', () => {
    const result = computeRuntimeReconcile({
      workspace: workspace({
        alignments: {
          gate: 'both_closed',
          local: { estado: 'P' },
          visitante: { estado: '' },
        },
      }),
    })
    expect(result.findings.some((f) => f.code === 'WORKSPACE_GATE_MISMATCH')).toBe(true)
    expect(result.lifecycle.expectedGate).not.toBe(result.lifecycle.gate)
  })

  it('staleGraph incluye versiones y refs por lado', () => {
    const ref = closedRef({ storageKey: STORAGE_LOCAL })
    const ws = workspace({
      alignments: {
        local: {
          estado: 'C',
          version: ref.documentVersion,
          alignmentRef: ref,
          players: [{ playerId: 'p1', jugador: 'A', dorsal: 9, titular: true, suplente: false, capitan: true }],
        },
      },
    })
    const result = computeRuntimeReconcile({ workspace: ws })
    expect(result.staleGraph.workspaceVersion).toBe(3)
    expect(result.staleGraph.local.ref?.storageKey).toBe(STORAGE_LOCAL)
    expect(result.versions.workspaceVersion).toBe(3)
    expect(result.versions.local.refDocumentVersion).toBe(2)
  })

  it('refs diagnostics exponen staleFlags y supersededCandidate', () => {
    const ref = closedRef({ lifecycle: 'REOPENED' })
    const result = computeRuntimeReconcile({
      workspace: workspace({
        workflow: { actaBinding: 'SUPERSEDED' },
        alignments: {
          local: { estado: 'C', version: 1, alignmentRef: ref, players: [] },
        },
      }),
    })
    const localRef = result.refs.find((r) => r.side === 'local')
    expect(localRef?.supersededCandidate).toBe(true)
    expect(localRef?.staleFlags.length).toBeGreaterThan(0)
  })

  it('runReconcile shape estructurado', () => {
    const result = computeRuntimeReconcile({ workspace: workspace() })
    expect(result).toMatchObject({
      ok: expect.any(Boolean),
      findings: expect.any(Array),
      refs: expect.any(Array),
      versions: expect.any(Object),
      staleGraph: expect.any(Object),
      lifecycle: expect.any(Object),
      binding: expect.any(Object),
    })
  })
})
