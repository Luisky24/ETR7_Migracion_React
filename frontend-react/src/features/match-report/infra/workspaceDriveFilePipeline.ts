/**
 * Pipeline atómico JSON para Encounter Workspace (misma semántica que actaDriveFilePipeline).
 */

import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'
import { legacyActaDocumentToWorkspace } from '../adapters/workspaceActa.mapper'
import type { ActaDocumentV1 } from '../contracts/actaDocument'
import {
  atomicReplaceDocumentInMap,
  safeParseJson,
  type AtomicReplaceResult,
  type DriveFileMap,
} from './actaDriveFilePipeline'

export type { DriveFileMap } from './actaDriveFilePipeline'

export function serializeEncounterWorkspace(doc: EncounterWorkspaceDocumentV1): string {
  return JSON.stringify(doc)
}

export function cloneWorkspace(doc: EncounterWorkspaceDocumentV1): EncounterWorkspaceDocumentV1 {
  return JSON.parse(JSON.stringify(doc)) as EncounterWorkspaceDocumentV1
}

export function atomicReplaceWorkspaceInMap(
  files: DriveFileMap,
  documentFileName: string,
  jsonContent: string,
): AtomicReplaceResult {
  return atomicReplaceDocumentInMap(files, documentFileName, jsonContent)
}

export function readOfficialWorkspaceFromMap(
  files: DriveFileMap,
  documentFileName: string,
): EncounterWorkspaceDocumentV1 | null {
  const entry = files.get(`${documentFileName}.json`)
  if (!entry) return null
  const parsed = safeParseJson(entry.content)
  if (!parsed.ok) return null
  return normalizeStoredWorkspace(parsed.value)
}

export function findWorkspaceByMatchIdInMap(
  files: DriveFileMap,
  matchId: string,
): { documentFileName: string; workspace: EncounterWorkspaceDocumentV1 } | null {
  for (const [name, entry] of files.entries()) {
    if (!name.endsWith('.json') || name.includes('.json.')) continue
    const parsed = safeParseJson(entry.content)
    if (!parsed.ok) continue
    const raw = parsed.value as Record<string, unknown>
    const id =
      (raw.identity as { matchId?: string } | undefined)?.matchId ??
      (raw.match as { matchId?: string } | undefined)?.matchId
    if (id === matchId) {
      const documentFileName = name.replace(/\.json$/, '')
      const workspace = normalizeStoredWorkspace(raw)
      if (!workspace) continue
      return { documentFileName, workspace }
    }
  }
  return null
}

/** Acepta workspace nativo o legado ActaDocumentV1 en almacén. */
export function normalizeStoredWorkspace(raw: unknown): EncounterWorkspaceDocumentV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (record.identity && record.metadata && record.alignments) {
    return cloneWorkspace(raw as EncounterWorkspaceDocumentV1)
  }
  if (record.match && record.metadata) {
    return legacyActaDocumentToWorkspace(raw as ActaDocumentV1)
  }
  return null
}
