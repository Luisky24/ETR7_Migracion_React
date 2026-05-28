import {
  backupFileName,
  officialFileName,
  previousFileName,
  tmpFileName,
} from '@/features/match-report/persistence/workspaceRepositoryKeys'

/**
 * Naming oficial: `ALI_{equipo}_{fase}_{encuentro}.json`
 * Ojo: las funciones de *FileName añaden sufijo `.json` y variantes auxiliares.
 */
export function buildAlignmentDocumentName(
  teamCode: string,
  phaseCode: string,
  encounterCode: string,
): string {
  return `ALI_${teamCode}_${phaseCode}_${encounterCode}`
}

export const ALIGNMENT_INDEX_DOCUMENT_NAME = 'indice_ultima_alineacion'

export { backupFileName, officialFileName, previousFileName, tmpFileName }

