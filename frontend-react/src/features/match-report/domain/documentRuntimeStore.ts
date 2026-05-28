/**
 * A4.3 — Cache/runtime documental único (MatchReport, MatchLineups, diagnostics).
 */

import type { EncounterWorkspaceLoadResult } from '../contracts/encounterWorkspaceLoad.contract'
import type { MatchReportDocumentRuntimeState } from '../types/matchReportDocumentRuntime.types'
import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'
import { normalizeDocumentRuntimeFromWorkspaceLoad } from './normalizeDocumentRuntime'

export interface DocumentRuntimeEntry {
  readonly matchId: string
  readonly document: MatchReportDocumentRuntimeState
  readonly workspace: EncounterWorkspaceDocumentV1
  readonly loadResult: EncounterWorkspaceLoadResult
}

let entry: DocumentRuntimeEntry | null = null

export function commitDocumentRuntimeLoad(
  result: EncounterWorkspaceLoadResult,
): MatchReportDocumentRuntimeState {
  const document = normalizeDocumentRuntimeFromWorkspaceLoad(result)
  entry = {
    matchId: document.matchId,
    document,
    workspace: result.workspace,
    loadResult: result,
  }
  return document
}

export function getDocumentRuntimeEntry(matchId?: string): DocumentRuntimeEntry | null {
  if (!entry) return null
  if (matchId && entry.matchId !== matchId) return null
  return entry
}

export function getDocumentRuntimeDocument(
  matchId?: string,
): MatchReportDocumentRuntimeState | null {
  return getDocumentRuntimeEntry(matchId)?.document ?? null
}

export function getDocumentRuntimeWorkspace(
  matchId?: string,
): EncounterWorkspaceDocumentV1 | null {
  return getDocumentRuntimeEntry(matchId)?.workspace ?? null
}

export function getDocumentRuntimeLoadResult(
  matchId?: string,
): EncounterWorkspaceLoadResult | null {
  return getDocumentRuntimeEntry(matchId)?.loadResult ?? null
}

export function clearDocumentRuntimeStore(): void {
  entry = null
}

