/**
 * A3.9 — Herramientas diagnósticas operacionales (sin UI).
 * Pensadas para staging: dumps, detección de corrupción, stale graph y reparación best-effort.
 */

import type { AlignmentDocumentV1 } from '@/shared/contracts/alignment.document'
import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'
import type { AlignmentDocumentKey, AlignmentDocumentRepository } from '../persistence/alignmentDocument.repository'
import type { EncounterWorkspaceRepository } from '@/features/match-report/persistence/encounterWorkspace.repository'
import { reconcileAlignmentWorkspace } from '@/features/match-report/adapters/alignmentWorkspace.integration'

export interface DumpAlignmentLifecycleEntry {
  readonly storageKey: string
  readonly state: AlignmentDocumentV1['lifecycle']['state']
  readonly documentVersion: number
  readonly closeRevision?: number
  readonly historyLen: number
  readonly auditLen: number
  readonly lastTransition?: AlignmentDocumentV1['lifecycle']['history'][number]
}

function log(event: string, data?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.info(event, data ?? {})
}

export async function dumpAlignmentLifecycle(
  repo: AlignmentDocumentRepository,
  key: AlignmentDocumentKey,
): Promise<DumpAlignmentLifecycleEntry | null> {
  const doc = await repo.loadAlignmentDocument(key)
  if (!doc) return null
  log('[ALIGNMENT-STRESS] dumpAlignmentLifecycle', {
    storageKey: doc.identity.storageKey,
    documentVersion: doc.metadata.documentVersion,
    closeRevision: doc.closure?.closeRevision,
    state: doc.lifecycle.state,
  })
  return {
    storageKey: doc.identity.storageKey,
    state: doc.lifecycle.state,
    documentVersion: doc.metadata.documentVersion,
    closeRevision: doc.closure?.closeRevision,
    historyLen: doc.lifecycle.history.length,
    auditLen: doc.audit.events.length,
    lastTransition: doc.lifecycle.history.at(-1),
  }
}

export interface DumpWorkspaceAlignmentState {
  readonly matchId: string
  readonly workspaceVersion: number
  readonly actaBinding: EncounterWorkspaceDocumentV1['workflow']['actaBinding']
  readonly gate: EncounterWorkspaceDocumentV1['alignments']['gate']
  readonly localRef?: EncounterWorkspaceDocumentV1['alignments']['local']['alignmentRef']
  readonly visitanteRef?: EncounterWorkspaceDocumentV1['alignments']['visitante']['alignmentRef']
}

export async function dumpWorkspaceAlignmentState(
  repo: EncounterWorkspaceRepository,
  matchKey: { category: 'M' | 'F'; phase: 'Fase I' | 'Fase II'; matchId: string },
): Promise<DumpWorkspaceAlignmentState | null> {
  const ws = await repo.loadWorkspace(matchKey)
  if (!ws) return null
  log('[ALIGNMENT-RECONCILE] dumpWorkspaceAlignmentState', {
    matchId: ws.identity.matchId,
    workspaceVersion: ws.metadata.workspaceVersion,
    actaBinding: ws.workflow.actaBinding,
    gate: ws.alignments.gate,
  })
  return {
    matchId: ws.identity.matchId,
    workspaceVersion: ws.metadata.workspaceVersion,
    actaBinding: ws.workflow.actaBinding,
    gate: ws.alignments.gate,
    localRef: ws.alignments.local.alignmentRef,
    visitanteRef: ws.alignments.visitante.alignmentRef,
  }
}

export interface StaleCascadeNode {
  readonly kind: 'alignment' | 'workspace'
  readonly key: string
  readonly issues: readonly string[]
}

export function detectAlignmentStaleCascade(input: {
  readonly workspace: EncounterWorkspaceDocumentV1
  readonly local: AlignmentDocumentV1 | null
  readonly visitante: AlignmentDocumentV1 | null
}): readonly StaleCascadeNode[] {
  const out: StaleCascadeNode[] = []
  if (!input.local || !input.visitante) {
    out.push({ kind: 'alignment', key: 'missing', issues: ['ALIGNMENT_MISSING'] })
    return out
  }
  const reconciled = reconcileAlignmentWorkspace(input.workspace, {
    local: input.local,
    visitante: input.visitante,
  })
  const codes = reconciled.findings.map((f) => f.code)
  if (codes.length) {
    out.push({ kind: 'workspace', key: input.workspace.identity.matchId, issues: codes })
  }
  log('[ALIGNMENT-STALE] staleCascade', {
    matchId: input.workspace.identity.matchId,
    localStorageKey: input.local.identity.storageKey,
    visitanteStorageKey: input.visitante.identity.storageKey,
    codes,
  })
  return out
}

export async function repairAlignmentWorkspaceRefs(input: {
  readonly workspaceRepo: EncounterWorkspaceRepository
  readonly workspaceKey: { category: 'M' | 'F'; phase: 'Fase I' | 'Fase II'; matchId: string }
  readonly workspace: EncounterWorkspaceDocumentV1
  readonly local: AlignmentDocumentV1
  readonly visitante: AlignmentDocumentV1
}): Promise<{ ok: boolean; repaired?: EncounterWorkspaceDocumentV1; codes: readonly string[] }> {
  const rec = reconcileAlignmentWorkspace(input.workspace, {
    local: input.local,
    visitante: input.visitante,
  })
  const codes = rec.findings.map((f) => f.code)
  const repaired = rec.patched ?? input.workspace
  // best-effort commit (solo si cambia)
  if (repaired !== input.workspace) {
    log('[ALIGNMENT-RECOVERY] repairAlignmentWorkspaceRefs.commit', {
      matchId: input.workspace.identity.matchId,
      codes,
    })
    await input.workspaceRepo.atomicReplaceWorkspace(input.workspaceKey, repaired)
  }
  return { ok: true, repaired, codes }
}

