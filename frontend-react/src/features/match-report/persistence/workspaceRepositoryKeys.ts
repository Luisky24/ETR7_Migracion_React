import type { ActaMatchKey } from '../contracts/actaDocument'
import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'

export function buildWorkspaceStorageKey(key: ActaMatchKey): string {
  return `${key.category}::${key.phase}::${key.matchId}`
}

export function workspaceKeyFromDocument(doc: EncounterWorkspaceDocumentV1): ActaMatchKey {
  return {
    category: doc.identity.category,
    phase: doc.identity.phase,
    matchId: doc.identity.matchId,
  }
}

export {
  backupFileName,
  officialFileName,
  previousFileName,
  tmpFileName,
  isAuxiliaryActaFile as isAuxiliaryWorkspaceFile,
} from './actaRepositoryKeys'
