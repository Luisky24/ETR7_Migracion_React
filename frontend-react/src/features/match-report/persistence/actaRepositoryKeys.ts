import type { ActaDocumentV1, ActaMatchKey } from '../contracts/actaDocument'

export function buildStorageKey(key: ActaMatchKey): string {
  return `${key.category}::${key.phase}::${key.matchId}`
}

export function keyFromDocument(doc: ActaDocumentV1): ActaMatchKey {
  return {
    category: doc.match.category,
    phase: doc.match.phase,
    matchId: doc.match.matchId,
  }
}

export function officialFileName(documentName: string): string {
  return `${documentName}.json`
}

export function tmpFileName(documentName: string): string {
  return `${documentName}.json.tmp`
}

export function backupFileName(documentName: string): string {
  return `${documentName}.json.backup`
}

export function previousFileName(documentName: string): string {
  return `${documentName}.json.previous`
}

/** Archivos auxiliares de persistencia (no son actas oficiales). */
export function isAuxiliaryActaFile(fileName: string): boolean {
  return (
    fileName.endsWith('.json.tmp') ||
    fileName.endsWith('.json.backup') ||
    fileName.endsWith('.json.previous')
  )
}
