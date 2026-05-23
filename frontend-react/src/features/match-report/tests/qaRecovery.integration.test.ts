import { beforeEach, describe, expect, it } from 'vitest'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import { resolveRecoveryPolicy } from '../utils/recoveryPolicy'
import { normalizeOperationError } from '../utils/errorNormalizer'
import { createQaSimulatedError, __setQaRuntimeFlagsForTest, resetQaRuntimeSimulation } from '../utils/qaRuntimeSimulation'
import { isServiceSuccess } from '../contracts/service-result.contract'
import { saveMatchReportDraftSafe } from '../services/matchReport.service.wrapped'
import { setMatchReportServiceMode } from '../services/matchReport.service'
import { emptyMatchReport } from './fixtures'
import { buildMatchPersistenceDto } from '../utils/persistenceDto'
import { selectCanRetrySave } from '../selectors/matchReportOperationSelectors'

describe('QA recovery integration', () => {
  beforeEach(() => {
    resetQaRuntimeSimulation()
    setMatchReportServiceMode('mock')
    __setQaRuntimeFlagsForTest({})
  })

  it('fallo save simulado preserva dirty y expone retry', async () => {
    let state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: {
        response: { report: emptyMatchReport(), cerrada: false, fromActaSnapshot: false },
      },
    })
    const playerId = state.report!.local.players[0]!.playerId
    state = matchReportReducer(state, {
      type: 'UPDATE_ACTIONS',
      payload: { side: 'local', playerId, patch: { E: 1 } },
    })
    expect(state.dirty).toBe(true)

    __setQaRuntimeFlagsForTest({ failSaveOnce: true })
    const report = state.report!
    const dto = buildMatchPersistenceDto(report, false)
    const saveResult = await saveMatchReportDraftSafe(dto, report)
    expect(isServiceSuccess(saveResult)).toBe(false)

    const operationError = normalizeOperationError(createQaSimulatedError('save', 'recoverable'))
    const { hints } = resolveRecoveryPolicy('loaded', operationError, true, state.dirty)
    state = matchReportReducer(state, {
      type: 'SAVE_DRAFT_FAILURE',
      payload: {
        error: operationError.userMessage,
        operationError,
        recovery: hints,
      },
    })

    expect(state.dirty).toBe(true)
    expect(state.report?.local.players[0]?.actions.E).toBe(1)
    expect(selectCanRetrySave(state)).toBe(true)

    __setQaRuntimeFlagsForTest({})
    const retryResult = await saveMatchReportDraftSafe(dto, state.report!)
    expect(isServiceSuccess(retryResult)).toBe(true)
  })
})
