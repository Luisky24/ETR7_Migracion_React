import { describe, expect, it } from 'vitest'
import type { EncounterWorkspaceLoadResult } from '../contracts/encounterWorkspaceLoad.contract'
import { normalizeDocumentRuntimeFromWorkspaceLoad } from '../domain/normalizeDocumentRuntime'
import { emptyMatchReport, minimalEncounterWorkspace } from './fixtures'

describe('A4.2 normalizeDocumentRuntime', () => {
  it('produce document runtime con metadata y reconcile', () => {
    const report = emptyMatchReport()
    const workspace = minimalEncounterWorkspace(report.context.encuentroId)
    const result: EncounterWorkspaceLoadResult = {
      source: 'workspace_shell',
      lifecycle: 'NO_EXISTE',
      report,
      workspace,
      workspaceVersion: workspace.metadata.workspaceVersion,
    }
    const document = normalizeDocumentRuntimeFromWorkspaceLoad(result)
    expect(document.matchId).toBe(report.context.encuentroId)
    expect(document.metadata.workspaceVersion).toBe(1)
    expect(document.metadata.actaLifecycle).toBe('NO_EXISTE')
    expect(document.reconcile.ok).toBe(true)
    expect(document.projections.local.side).toBe('local')
  })

  it('detecta SUPERSEDED en normalize', () => {
    const report = emptyMatchReport()
    const workspace = {
      ...minimalEncounterWorkspace(report.context.encuentroId),
      workflow: { actaBinding: 'SUPERSEDED' as const },
    }
    const document = normalizeDocumentRuntimeFromWorkspaceLoad({
      source: 'workspace_acta',
      lifecycle: 'ACTA_EN_CURSO',
      report,
      workspace,
      workspaceVersion: 1,
    })
    expect(document.superseded.isSuperseded).toBe(true)
    expect(document.reconcile.findingCodes).toContain('WORKSPACE_SUPERSEDED')
  })
})
