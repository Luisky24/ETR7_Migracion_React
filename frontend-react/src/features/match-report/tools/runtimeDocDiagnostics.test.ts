import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRuntimeDocDiagnosticsApi, installRuntimeDocDiagnostics, isRuntimeDocDiagnosticsEnabled } from './runtimeDocDiagnostics'
import type { MatchReportState } from '@/features/match-report/types/matchReportState.types'
import {
  commitDocumentRuntimeLoad,
  clearDocumentRuntimeStore,
} from '@/features/match-report/domain/documentRuntimeStore'
import { emptyMatchReport, minimalEncounterWorkspace, minimalDocumentRuntime } from '@/features/match-report/tests/fixtures'
import type { EncounterWorkspaceLoadResult } from '@/features/match-report/contracts/encounterWorkspaceLoad.contract'

function seedRuntimeCache(): void {
  const report = emptyMatchReport()
  const workspace = minimalEncounterWorkspace(report.context.encuentroId)
  const loadResult: EncounterWorkspaceLoadResult = {
    source: 'workspace_shell',
    lifecycle: 'NO_EXISTE',
    report,
    workspace,
    workspaceVersion: workspace.metadata.workspaceVersion,
  }
  commitDocumentRuntimeLoad(loadResult)
}

function minimalState(): MatchReportState {
  return {
    context: {
      category: 'M',
      phase: 'Fase I',
      encuentroId: 'A|LOCAL|VISITANTE',
      grupo: 'G',
      equipoLocal: 'L',
      equipoVisitante: 'V',
      hora: '10:00',
      campo: 'C',
      resultadoDisplay: '0-0',
      estadoAlineacionesDisplay: '—',
      matchStatus: 'acta_abierta',
      referenciaEncuentro: '',
    },
    report: null,
    savedSnapshot: null,
    document: minimalDocumentRuntime('A|LOCAL|VISITANTE'),
    dirty: false,
    error: null,
    lastValidation: null,
    lastClosure: null,
    operation: 'idle',
    operationError: null,
    recovery: null,
  }
}

describe('A4.3 runtimeDocDiagnostics (unified cache)', () => {
  beforeEach(() => {
    clearDocumentRuntimeStore()
    seedRuntimeCache()
  })

  it('env() returns snapshot object', () => {
    const api = createRuntimeDocDiagnosticsApi(() => minimalState())
    expect(api.env()).toBeTruthy()
  })

  it('help() lista comandos de soporte', () => {
    const api = createRuntimeDocDiagnosticsApi(() => minimalState())
    const help = api.help()
    expect(help.commands.length).toBeGreaterThanOrEqual(6)
    expect(help.commands.some((c) => c.fn === 'runReconcile()')).toBe(true)
  })

  it('dumpActaLifecycle uses cache without network load', async () => {
    const api = createRuntimeDocDiagnosticsApi(() => minimalState())
    const out = await api.dumpActaLifecycle('A|LOCAL|VISITANTE')
    expect(out.matchId).toBe('A|LOCAL|VISITANTE')
    expect(out.reconcile?.ok).toBe(true)
  })

  it('runReconcile returns structured result from document cache', async () => {
    const api = createRuntimeDocDiagnosticsApi(() => minimalState())
    const result = await api.runReconcile()
    expect(result.ok).toBe(true)
    expect(result.refs).toHaveLength(2)
    expect(result.staleGraph.matchId).toBe('A|LOCAL|VISITANTE')
  })

  it('fails when cache empty', async () => {
    clearDocumentRuntimeStore()
    const api = createRuntimeDocDiagnosticsApi(() => minimalState())
    await expect(api.runReconcile()).rejects.toThrow(/Cache documental/)
  })
})

describe('runtime doc diagnostics visibility', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { ...globalThis.window })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('isRuntimeDocDiagnosticsEnabled false in production-like env', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('MODE', 'production')
    vi.doMock('@/app/runtimeProfile', () => ({
      isStagingGasRuntime: () => false,
      getRuntimeProfile: () => 'production',
    }))
    const mod = await import('./runtimeDocDiagnostics')
    expect(mod.isRuntimeDocDiagnosticsEnabled()).toBe(false)
  })

  it('installRuntimeDocDiagnostics no expone __ETR7_DOC__ en production-like env', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('MODE', 'production')
    vi.doMock('@/app/runtimeProfile', () => ({
      isStagingGasRuntime: () => false,
      getRuntimeProfile: () => 'production',
    }))
    const mod = await import('./runtimeDocDiagnostics')
    mod.installRuntimeDocDiagnostics(() => minimalState())
    expect((window as { __ETR7_DOC__?: unknown }).__ETR7_DOC__).toBeUndefined()
  })
})
