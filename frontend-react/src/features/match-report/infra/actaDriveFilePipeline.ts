/**
 * Pipeline puro read → parse → validate → tmp → verify → replace → verify.
 * Espejo del comportamiento Drive/GAS; usado por FakeDriveStore y tests.
 */

import type { ActaDocumentV1 } from '../contracts/actaDocument'
import { cloneDocument } from '../persistence/actaPersistenceError'
import {
  backupFileName,
  officialFileName,
  previousFileName,
  tmpFileName,
} from '../persistence/actaRepositoryKeys'

export interface DriveFileEntry {
  content: string
  mimeType?: string
}

export type DriveFileMap = Map<string, DriveFileEntry>

export interface ParseJsonResult {
  readonly ok: boolean
  readonly value?: unknown
  readonly error?: string
}

export function safeParseJson(text: string): ParseJsonResult {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function serializeActaDocument(doc: ActaDocumentV1): string {
  return JSON.stringify(doc)
}

export interface AtomicReplaceResult {
  readonly ok: boolean
  readonly code?: 'IO_FAILURE' | 'VALIDATION_FAILED'
  readonly message?: string
}

/**
 * Simula atomic replace en un mapa de ficheros (misma semántica que GAS).
 */
export function atomicReplaceDocumentInMap(
  files: DriveFileMap,
  documentName: string,
  jsonContent: string,
): AtomicReplaceResult {
  const official = officialFileName(documentName)
  const tmp = tmpFileName(documentName)
  const backup = backupFileName(documentName)
  const previous = previousFileName(documentName)

  const parsed = safeParseJson(jsonContent)
  if (!parsed.ok) {
    return { ok: false, code: 'VALIDATION_FAILED', message: `JSON inválido en tmp: ${parsed.error}` }
  }

  files.set(tmp, { content: jsonContent, mimeType: 'application/json' })

  const tmpRead = files.get(tmp)
  if (!tmpRead || tmpRead.content !== jsonContent) {
    files.delete(tmp)
    return { ok: false, code: 'IO_FAILURE', message: 'Verificación tmp fallida' }
  }

  const current = files.get(official)
  if (current) {
    files.set(backup, { content: current.content, mimeType: current.mimeType })
    files.set(previous, { content: current.content, mimeType: current.mimeType })
    files.set(official, { content: jsonContent, mimeType: 'application/json' })
  } else {
    files.set(official, { content: jsonContent, mimeType: 'application/json' })
  }

  files.delete(tmp)

  const finalRead = files.get(official)
  if (!finalRead || finalRead.content !== jsonContent) {
    return { ok: false, code: 'IO_FAILURE', message: 'Verificación final fallida' }
  }

  return { ok: true }
}

export function readOfficialDocumentFromMap(
  files: DriveFileMap,
  documentName: string,
): ActaDocumentV1 | null {
  const entry = files.get(officialFileName(documentName))
  if (!entry) return null
  const parsed = safeParseJson(entry.content)
  if (!parsed.ok) return null
  return cloneDocument(parsed.value as ActaDocumentV1)
}

export function findDocumentByMatchIdInMap(
  files: DriveFileMap,
  matchId: string,
): { documentName: string; document: ActaDocumentV1 } | null {
  for (const [name, entry] of files.entries()) {
    if (!name.endsWith('.json') || name.includes('.json.')) continue
    const parsed = safeParseJson(entry.content)
    if (!parsed.ok) continue
    const doc = parsed.value as ActaDocumentV1
    if (doc?.match?.matchId === matchId) {
      const documentName = name.replace(/\.json$/, '')
      return { documentName, document: cloneDocument(doc) }
    }
  }
  return null
}
