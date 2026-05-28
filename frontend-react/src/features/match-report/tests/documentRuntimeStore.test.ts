import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearDocumentRuntimeStore,
  commitDocumentRuntimeLoad,
  getDocumentRuntimeEntry,
} from '../domain/documentRuntimeStore'
import { loadDocumentRuntime } from '../services/documentRuntimeLoad.service'
import { emptyMatchReport, minimalEncounterWorkspace } from './fixtures'
import type { EncounterWorkspaceLoadResult } from '../contracts/encounterWorkspaceLoad.contract'
import { vi } from 'vitest'
import type { EncounterWorkspaceLoadPort } from '../contracts/encounterWorkspaceLoad.contract'
import { baseContext } from './fixtures'

describe('A4.3 documentRuntimeStore', () => {
  beforeEach(() => {
    clearDocumentRuntimeStore()
  })

  it('commit stores document + workspace', () => {
    const report = emptyMatchReport()
    const workspace = minimalEncounterWorkspace(report.context.encuentroId)
    const result: EncounterWorkspaceLoadResult = {
      source: 'workspace_shell',
      lifecycle: 'NO_EXISTE',
      report,
      workspace,
      workspaceVersion: 1,
    }
    const doc = commitDocumentRuntimeLoad(result)
    const entry = getDocumentRuntimeEntry(report.context.encuentroId)
    expect(entry?.document).toBe(doc)
    expect(entry?.workspace).toBe(workspace)
  })

  it('loadDocumentRuntime reuses cache without second port.load', async () => {
    const context = baseContext()
    const report = emptyMatchReport(context)
    const workspace = minimalEncounterWorkspace(context.encuentroId)
    const load = vi.fn(async () => ({
      source: 'workspace_shell' as const,
      lifecycle: 'NO_EXISTE' as const,
      report,
      workspace,
      workspaceVersion: 1,
    }))
    const port: EncounterWorkspaceLoadPort = { load }
    await loadDocumentRuntime(context, { workspaceLoadPort: port })
    await loadDocumentRuntime(context, { workspaceLoadPort: port })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('force reload calls port again', async () => {
    const context = baseContext()
    const report = emptyMatchReport(context)
    const workspace = minimalEncounterWorkspace(context.encuentroId)
    const load = vi.fn(async () => ({
      source: 'workspace_shell' as const,
      lifecycle: 'NO_EXISTE' as const,
      report,
      workspace,
      workspaceVersion: 1,
    }))
    const port: EncounterWorkspaceLoadPort = { load }
    await loadDocumentRuntime(context, { workspaceLoadPort: port })
    await loadDocumentRuntime(context, { workspaceLoadPort: port, force: true })
    expect(load).toHaveBeenCalledTimes(2)
  })
})
