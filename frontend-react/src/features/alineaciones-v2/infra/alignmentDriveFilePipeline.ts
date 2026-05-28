/**
 * Pipeline atómico JSON para AlignmentDocumentV1 (tmp/backup/previous) — espejo de workspaceDriveFilePipeline.
 */

import type { AlignmentDocumentV1 } from '@/shared/contracts/alignment.document'
import {
  atomicReplaceDocumentInMap,
  safeParseJson,
  type AtomicReplaceResult,
  type DriveFileMap,
} from '@/features/match-report/infra/actaDriveFilePipeline'
import { ALIGNMENT_INDEX_DOCUMENT_NAME } from '../persistence/alignmentRepositoryKeys'

export type { DriveFileMap } from '@/features/match-report/infra/actaDriveFilePipeline'

export function serializeAlignmentDocument(doc: AlignmentDocumentV1): string {
  return JSON.stringify(doc)
}

export function cloneAlignment(doc: AlignmentDocumentV1): AlignmentDocumentV1 {
  return JSON.parse(JSON.stringify(doc)) as AlignmentDocumentV1
}

export function atomicReplaceAlignmentInMap(
  files: DriveFileMap,
  documentName: string,
  jsonContent: string,
): AtomicReplaceResult {
  return atomicReplaceDocumentInMap(files, documentName, jsonContent)
}

export function readOfficialAlignmentFromMap(
  files: DriveFileMap,
  documentName: string,
): AlignmentDocumentV1 | null {
  const entry = files.get(`${documentName}.json`)
  if (!entry) return null
  const parsed = safeParseJson(entry.content)
  if (!parsed.ok) return null
  const raw = parsed.value
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (record.schema !== 'AlignmentDocumentV1') return null
  return cloneAlignment(raw as AlignmentDocumentV1)
}

export function findAlignmentByStorageKeyInMap(
  files: DriveFileMap,
  storageKey: string,
): { documentName: string; doc: AlignmentDocumentV1 } | null {
  for (const [name, entry] of files.entries()) {
    if (!name.endsWith('.json') || name.includes('.json.')) continue
    if (name === `${ALIGNMENT_INDEX_DOCUMENT_NAME}.json`) continue
    const parsed = safeParseJson(entry.content)
    if (!parsed.ok) continue
    const raw = parsed.value as Record<string, unknown>
    if (raw?.schema !== 'AlignmentDocumentV1') continue
    const id = (raw.identity as { storageKey?: string } | undefined)?.storageKey
    if (id === storageKey) {
      const documentName = name.replace(/\.json$/, '')
      return { documentName, doc: cloneAlignment(raw as AlignmentDocumentV1) }
    }
  }
  return null
}

export function readIndexFromMap(files: DriveFileMap): unknown | null {
  const entry = files.get(`${ALIGNMENT_INDEX_DOCUMENT_NAME}.json`)
  if (!entry) return null
  const parsed = safeParseJson(entry.content)
  if (!parsed.ok) return null
  return parsed.value ?? null
}

