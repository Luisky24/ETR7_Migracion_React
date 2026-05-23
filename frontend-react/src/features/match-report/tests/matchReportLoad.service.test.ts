import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EncounterWorkspaceLoadPort } from '../contracts/encounterWorkspaceLoad.contract'
import type { LoadMatchReportResponse, MatchContext } from '../contracts'
import { parseActaPersistenceMode, usesJsonPersistence } from '../config/persistenceFlags'
import { EncounterWorkspaceLoadError } from '../infra/encounterWorkspaceLoad.errors'
import {
  workspaceLoadResultToLoadResponse,
  loadMatchReportForRuntimeSafe,
} from '../services/matchReportLoad.service'
import { normalizeWorkspaceLoadError } from '../utils/bootstrapLoadErrors'
import { baseContext, emptyMatchReport } from './fixtures'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import { buildOperationFailurePayload } from '../utils/operationDispatch'
import { createFakeDriveJsonPersistenceRepository } from '../infra/jsonPersistence.adapter'
import { createEncounterWorkspaceLoadAdapter } from '../infra/encounterWorkspaceLoad.adapter'
import { EncounterWorkspaceRepository } from '../persistence/encounterWorkspace.repository'
import {
  buildActaDocumentName,
  projectMatchReportToActaDocument,
} from '../adapters/actaProjection.adapter'
import type { EncounterWorkspaceLoadResult } from '../contracts/encounterWorkspaceLoad.contract'

describe('persistenceFlags', () => {
  it('parseActaPersistenceMode', () => {
    expect(parseActaPersistenceMode('legacy')).toBe('legacy')
    expect(parseActaPersistenceMode('json')).toBe('json')
    expect(parseActaPersistenceMode('hybrid')).toBe('hybrid')
    expect(parseActaPersistenceMode(undefined)).toBe('legacy')
    expect(usesJsonPersistence('json')).toBe(true)
    expect(usesJsonPersistence('hybrid')).toBe(true)
    expect(usesJsonPersistence('legacy')).toBe(false)
  })
})

describe('loadMatchReportForRuntimeSafe', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. siempre usa Encounter Workspace load (sin legacy Sheets)', async () => {
    const context = baseContext()
    const loadPort: EncounterWorkspaceLoadPort = {
      load: vi.fn(async () => ({
        source: 'workspace_shell' as const,
        lifecycle: 'NO_EXISTE' as const,
        report: emptyMatchReport(context),
        workspace: {
          identity: {
            matchId: context.encuentroId,
            documentFileName: 'ENC_WS_Fase1_Encuentro1',
            encounter: { encounterNumber: 1 },
          },
          metadata: { workspaceVersion: 1 },
        } as EncounterWorkspaceLoadResult['workspace'],
        workspaceVersion: 1,
      })),
    }

    const result = await loadMatchReportForRuntimeSafe({ context }, { workspaceLoadPort: loadPort })

    expect(loadPort.load).toHaveBeenCalledOnce()
    expect(result.kind).toBe('success')
  })

  it('2. workspace_acta — fromActaSnapshot y cerrada coherentes', async () => {
    const context = baseContext({ matchStatus: 'acta_abierta' })
    const report = emptyMatchReport(context)
    const loadResult: EncounterWorkspaceLoadResult = {
      source: 'workspace_acta',
      lifecycle: 'ACTA_EN_CURSO',
      report: { ...report, fromActaSnapshot: true, cerrada: false },
      workspace: {} as EncounterWorkspaceLoadResult['workspace'],
      workspaceVersion: 2,
    }
    const response = workspaceLoadResultToLoadResponse(loadResult)
    expect(response.fromActaSnapshot).toBe(true)
    expect(response.cerrada).toBe(false)
  })

  it('3. workspace_alignments — editable sin snapshot acta', async () => {
    const context = baseContext()
    const legacy = emptyMatchReport(context)
    const loadResult: EncounterWorkspaceLoadResult = {
      source: 'workspace_alignments',
      lifecycle: 'NO_EXISTE',
      report: legacy,
      workspace: {} as EncounterWorkspaceLoadResult['workspace'],
      workspaceVersion: 1,
    }
    const response = workspaceLoadResultToLoadResponse(loadResult)
    expect(response.fromActaSnapshot).toBe(false)
    expect(response.report.local.players.length).toBeGreaterThan(0)
  })

  it('4. corrupción entra en error fatal bloqueado', () => {
    const err = normalizeWorkspaceLoadError(
      new EncounterWorkspaceLoadError('CORRUPT_DOCUMENT', 'workspace inválido'),
    )
    expect(err.code).toBe('CORRUPT_DOCUMENT')
    expect(err.shouldBlock).toBe(true)
    expect(err.recoverable).toBe(false)
  })

  it('5. retry sigue funcionando vía executeWithRetry', async () => {
    const context = baseContext()
    let calls = 0
    const loadPort: EncounterWorkspaceLoadPort = {
      load: vi.fn(async () => {
        calls += 1
        if (calls < 2) {
          throw new Error('fallo temporal io')
        }
        return {
          source: 'workspace_shell' as const,
          lifecycle: 'NO_EXISTE' as const,
          report: emptyMatchReport(context),
          workspace: {
            identity: {
              matchId: context.encuentroId,
              documentFileName: 'ENC_WS_Fase1_Encuentro1',
              encounter: { encounterNumber: 1 },
            },
            metadata: { workspaceVersion: 1 },
          } as EncounterWorkspaceLoadResult['workspace'],
          workspaceVersion: 1,
        }
      }),
    }

    const result = await loadMatchReportForRuntimeSafe({ context }, { workspaceLoadPort: loadPort })

    expect(result.kind).toBe('success')
    expect(calls).toBe(2)
  })

  it('6. ACTA_CERRADA hidrata read-only en runtime reducer', async () => {
    const context = baseContext({ matchStatus: 'acta_cerrada' })
    const report = {
      ...emptyMatchReport(context),
      cerrada: true,
      editability: 'read_only' as const,
      fromActaSnapshot: true,
    }
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: { report, cerrada: true, fromActaSnapshot: true } },
    })
    state = matchReportReducer(state, { type: 'LOCK_REPORT' })
    expect(state.report?.cerrada).toBe(true)
    expect(state.operation).toBe('locked')
  })

  it('7. integración workspace con acta persistida', async () => {
    const repo = createFakeDriveJsonPersistenceRepository()
    const context = baseContext()
    const doc = projectMatchReportToActaDocument({
      metadata: {
        schemaVersion: 1,
        documentVersion: 1,
        status: 'ACTA_EN_CURSO',
        createdAt: '2026-05-21T12:00:00.000Z',
        updatedAt: '2026-05-21T12:00:00.000Z',
      },
      report: emptyMatchReport(context),
      encounterNumber: 1,
      documentName: buildActaDocumentName('Fase I', 1),
    })
    await repo.save(doc, { intent: 'draft' })

    const loadPort = createEncounterWorkspaceLoadAdapter({
      workspaceRepository: new EncounterWorkspaceRepository(repo.driveStore),
    })
    const result = await loadMatchReportForRuntimeSafe({ context }, { workspaceLoadPort: loadPort })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.data.report.fromActaSnapshot).toBe(true)
    }
  })

  it('8. corrupción no usa fallback legacy', async () => {
    const context = baseContext()
    const loadPort: EncounterWorkspaceLoadPort = {
      load: vi.fn(async () => {
        throw new EncounterWorkspaceLoadError('CORRUPT_DOCUMENT', 'corrupto')
      }),
    }

    const result = await loadMatchReportForRuntimeSafe({ context }, { workspaceLoadPort: loadPort })

    expect(result.kind).toBe('fatalError')
  })

  it('recovery payload preserva dirty tras error recoverable', () => {
    const report = emptyMatchReport()
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: { report, cerrada: false, fromActaSnapshot: false } },
    })
    state = { ...state, dirty: true }
    const payload = buildOperationFailurePayload(
      state,
      new EncounterWorkspaceLoadError('IO_FAILURE', 'io'),
    )
    expect(state.report).not.toBeNull()
    expect(payload.recovery?.canRetrySave).toBeDefined()
  })
})
