import { describe, expect, it, beforeEach } from 'vitest'
import type { EncounterWorkspaceLoadResult } from '../contracts/encounterWorkspaceLoad.contract'
import { prepareDocumentRuntimeForEncounter } from '../domain/documentRuntimeNavigation'
import {
  clearDocumentRuntimeStore,
  commitDocumentRuntimeLoad,
  getDocumentRuntimeEntry,
} from '../domain/documentRuntimeStore'
import { baseContext, emptyMatchReport, minimalEncounterWorkspace } from './fixtures'

function workspaceLoadFor(matchId: string): EncounterWorkspaceLoadResult {
  const report = emptyMatchReport(baseContext({ encuentroId: matchId }))
  return {
    source: 'workspace_shell',
    lifecycle: 'NO_EXISTE',
    report,
    workspace: minimalEncounterWorkspace(matchId),
    workspaceVersion: 1,
  }
}

describe('A5 documentRuntimeNavigation', () => {
  beforeEach(() => {
    clearDocumentRuntimeStore()
  })

  it('prepareDocumentRuntimeForEncounter limpia cache al cambiar matchId', () => {
    commitDocumentRuntimeLoad(workspaceLoadFor('enc-a'))
    expect(getDocumentRuntimeEntry('enc-a')).not.toBeNull()

    prepareDocumentRuntimeForEncounter('enc-b', 'enc-a')
    expect(getDocumentRuntimeEntry('enc-a')).toBeNull()
    expect(getDocumentRuntimeEntry('enc-b')).toBeNull()
  })

  it('no limpia si mismo matchId', () => {
    commitDocumentRuntimeLoad(workspaceLoadFor('enc-same'))
    prepareDocumentRuntimeForEncounter('enc-same', 'enc-same')
    expect(getDocumentRuntimeEntry('enc-same')).not.toBeNull()
  })
})
