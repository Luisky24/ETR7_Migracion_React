/**
 * Integración documental controlada AlignmentDocumentV1 ↔ Encounter Workspace (A3.5).
 * - Workspace NO edita alineaciones; agrega refs + snapshot cerrado consumible.
 * - Acta consume snapshots consolidados.
 */

import type { AlignmentDocumentV1 } from '@/shared/contracts/alignment.document'
import type {
  AlignmentPlayerV1 as WorkspaceAlignmentPlayerV1,
  EncounterWorkspaceDocumentV1,
  TeamAlignmentDocumentV1,
  WorkspaceAlignmentRefV1,
} from '@/shared/contracts/encounter-workspace.document'

export interface AlignmentWorkspaceFinding {
  readonly code:
    | 'ALIGNMENT_MISSING'
    | 'ALIGNMENT_NOT_CLOSED'
    | 'ALIGNMENT_STALE_SNAPSHOT'
    | 'ALIGNMENT_REF_MISMATCH'
    | 'ALIGNMENT_SUPERSEDED_REQUIRED'
  readonly message: string
  readonly side?: 'local' | 'visitante'
}

export interface ReconcileAlignmentWorkspaceResult {
  readonly ok: boolean
  readonly findings: readonly AlignmentWorkspaceFinding[]
  readonly patched?: EncounterWorkspaceDocumentV1
}

function selectionFlags(
  snapshot: AlignmentDocumentV1['closure']['snapshot'],
  playerId: string,
): { titular: boolean; suplente: boolean; capitan: boolean } {
  const titular = snapshot.selection.starters.includes(playerId)
  const suplente = snapshot.selection.bench.includes(playerId)
  const capitan = snapshot.selection.captain === playerId
  return { titular, suplente, capitan }
}

function toWorkspacePlayers(
  snapshot: AlignmentDocumentV1['closure']['snapshot'],
): readonly WorkspaceAlignmentPlayerV1[] {
  return snapshot.players.map((p) => {
    const flags = selectionFlags(snapshot, p.playerId)
    return {
      playerId: p.playerId,
      jugador: p.displayName,
      dorsal: p.dorsal,
      titular: flags.titular,
      suplente: flags.suplente,
      capitan: flags.capitan,
    }
  })
}

export function buildWorkspaceAlignmentRefFromClosedDoc(
  doc: AlignmentDocumentV1,
): WorkspaceAlignmentRefV1 {
  if (doc.lifecycle.state !== 'CLOSED' || !doc.closure) {
    throw new Error('buildWorkspaceAlignmentRefFromClosedDoc requiere AlignmentDocument CLOSED con closure')
  }
  return {
    storageKey: doc.identity.storageKey,
    documentVersion: doc.metadata.documentVersion,
    closeRevision: doc.closure.closeRevision,
    lifecycle: doc.lifecycle.state,
    closedAt: doc.closure.closedAt,
    closedBy: doc.closure.closedBy,
    snapshot: doc.closure.snapshot,
  }
}

export function materializeWorkspaceTeamAlignmentFromClosedDoc(
  existing: TeamAlignmentDocumentV1,
  doc: AlignmentDocumentV1,
): TeamAlignmentDocumentV1 {
  const ref = buildWorkspaceAlignmentRefFromClosedDoc(doc)
  const players = toWorkspacePlayers(ref.snapshot)
  return {
    ...existing,
    estado: 'C',
    players,
    closedAt: ref.closedAt,
    closedBy: ref.closedBy,
    version: ref.documentVersion,
    alignmentRef: ref,
  }
}

export function reconcileAlignmentWorkspace(
  workspace: EncounterWorkspaceDocumentV1,
  docs: {
    readonly local?: AlignmentDocumentV1 | null
    readonly visitante?: AlignmentDocumentV1 | null
  },
): ReconcileAlignmentWorkspaceResult {
  const findings: AlignmentWorkspaceFinding[] = []

  const patchSide = (
    side: 'local' | 'visitante',
    existing: TeamAlignmentDocumentV1,
    doc: AlignmentDocumentV1 | null | undefined,
  ): TeamAlignmentDocumentV1 => {
    if (!doc) {
      findings.push({ code: 'ALIGNMENT_MISSING', message: 'AlignmentDocument ausente', side })
      return existing
    }
    if (doc.lifecycle.state !== 'CLOSED' || !doc.closure) {
      findings.push({ code: 'ALIGNMENT_NOT_CLOSED', message: 'AlignmentDocument no está CLOSED', side })
      return { ...existing, estado: 'P' }
    }

    const existingRef = existing.alignmentRef
    if (existingRef) {
      if (existingRef.storageKey !== doc.identity.storageKey) {
        findings.push({ code: 'ALIGNMENT_REF_MISMATCH', message: 'storageKey mismatch en ref', side })
      } else if (
        existingRef.closeRevision !== doc.closure.closeRevision ||
        existingRef.documentVersion !== doc.metadata.documentVersion
      ) {
        findings.push({ code: 'ALIGNMENT_STALE_SNAPSHOT', message: 'Snapshot stale vs AlignmentDocument', side })
      }
    }

    return materializeWorkspaceTeamAlignmentFromClosedDoc(existing, doc)
  }

  const local = patchSide('local', workspace.alignments.local, docs.local)
  const visitante = patchSide('visitante', workspace.alignments.visitante, docs.visitante)

  const gate =
    local.estado === 'C' && visitante.estado === 'C'
      ? 'both_closed'
      : local.estado === '' && visitante.estado === ''
        ? 'not_started'
        : 'in_progress'

  const patched: EncounterWorkspaceDocumentV1 = {
    ...workspace,
    alignments: {
      ...workspace.alignments,
      gate,
      local,
      visitante,
    },
  }

  const ok = findings.every((f) => f.code !== 'ALIGNMENT_REF_MISMATCH')
  return { ok, findings, patched }
}

