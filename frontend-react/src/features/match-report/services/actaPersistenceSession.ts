/**
 * Sesión de persistencia JSON por encuentro (fuera del reducer).
 * Mantiene `documentVersion`, naming y encounter para saves sin tocar dominio UI.
 */

import type { EncounterWorkspaceLoadResult } from '../contracts/encounterWorkspaceLoad.contract'
import type { ActaDocumentV1 } from '../contracts/actaDocument/actaDocument.contract'
import type { ActaBootstrapResult } from '../contracts/actaDocument'
import type { MatchContext } from '../contracts'
import { buildWorkspaceDocumentFileName } from '../adapters/workspaceActa.mapper'
import { matchKeyFromContext } from '../persistence/matchKey'
import { stableEncounterNumberFromMatchId } from '../persistence/encounterIdentity'

export interface ActaPersistenceSession {
  readonly documentName: string
  readonly encounterNumber: number
  /** Versión esperada en el siguiente update; `0` = primer create (`NO_EXISTE`). */
  readonly documentVersion: number
}

const sessions = new Map<string, ActaPersistenceSession>()

function sessionKey(matchId: string): string {
  return matchId
}

export function getActaPersistenceSession(matchId: string): ActaPersistenceSession | undefined {
  return sessions.get(sessionKey(matchId))
}

export function setActaPersistenceSession(matchId: string, session: ActaPersistenceSession): void {
  sessions.set(sessionKey(matchId), session)
}

export function clearActaPersistenceSession(matchId?: string): void {
  if (matchId == null) {
    sessions.clear()
    return
  }
  sessions.delete(sessionKey(matchId))
}

export function sessionFromActaDocument(document: ActaDocumentV1): ActaPersistenceSession {
  return {
    documentName: document.match.documentName,
    encounterNumber: document.match.encounter.encounterNumber,
    documentVersion: document.metadata.documentVersion,
  }
}

export { stableEncounterNumberFromMatchId } from '../persistence/encounterIdentity'

export function createInitialPersistenceSession(context: MatchContext): ActaPersistenceSession {
  const encounterNumber = stableEncounterNumberFromMatchId(context.encuentroId)
  return {
    documentName: buildWorkspaceDocumentFileName(context.phase, encounterNumber),
    encounterNumber,
    documentVersion: 0,
  }
}

export function syncActaPersistenceSessionFromWorkspaceLoad(
  result: EncounterWorkspaceLoadResult,
): void {
  const matchId = result.report.context.encuentroId
  if (!result.workspace?.identity?.encounter) {
    if (result.document) {
      setActaPersistenceSession(matchId, sessionFromActaDocument(result.document))
      return
    }
    setActaPersistenceSession(matchId, createInitialPersistenceSession(result.report.context))
    return
  }
  const encounterNumber =
    result.workspace.identity.encounter.encounterNumber ??
    stableEncounterNumberFromMatchId(matchId)

  if (result.document) {
    setActaPersistenceSession(matchId, sessionFromActaDocument(result.document))
    return
  }

  setActaPersistenceSession(matchId, {
    documentName: result.workspace.identity.documentFileName,
    encounterNumber,
    documentVersion: result.workspaceVersion,
  })
}

/** @deprecated Usar syncActaPersistenceSessionFromWorkspaceLoad */
export function syncActaPersistenceSessionFromBootstrap(result: ActaBootstrapResult): void {
  syncActaPersistenceSessionFromWorkspaceLoad(result)
}

export function actaMatchKeyFromContext(context: MatchContext) {
  return matchKeyFromContext(context)
}
