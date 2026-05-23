import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __setQaRuntimeFlagsForTest,
  assertQaRuntimeSimulation,
  createQaSimulatedError,
  isQaSimulatedError,
  resetQaRuntimeSimulation,
} from '../utils/qaRuntimeSimulation'
import { executeWithRetry } from '../utils/retryOperation'
import { normalizeOperationError } from '../utils/errorNormalizer'
import { isServiceSuccess } from '../contracts/service-result.contract'
import { saveMatchReportDraftSafe } from '../services/matchReport.service.wrapped'
import { setMatchReportServiceMode } from '../services/matchReport.service'
import { emptyMatchReport } from './fixtures'
import { buildMatchPersistenceDto } from '../utils/persistenceDto'

describe('qaRuntimeSimulation', () => {
  beforeEach(() => {
    resetQaRuntimeSimulation()
    __setQaRuntimeFlagsForTest({})
    setMatchReportServiceMode('mock')
  })

  afterEach(() => {
    resetQaRuntimeSimulation()
    __setQaRuntimeFlagsForTest(null)
  })

  it('failSaveOnce lanza una vez y permite éxito en el siguiente intento', async () => {
    __setQaRuntimeFlagsForTest({ failSaveOnce: true })
    const report = emptyMatchReport()
    const dto = buildMatchPersistenceDto(report, false)

    const first = await saveMatchReportDraftSafe(dto, report)
    expect(isServiceSuccess(first)).toBe(false)
    if (!isServiceSuccess(first)) {
      expect(first.kind).toBe('recoverableError')
    }

    const second = await saveMatchReportDraftSafe(dto, report)
    expect(isServiceSuccess(second)).toBe(true)
  })

  it('failSaveFatalOnce no es retryable', async () => {
    __setQaRuntimeFlagsForTest({ failSaveFatalOnce: true })
    const report = emptyMatchReport()
    const dto = buildMatchPersistenceDto(report, false)

    const result = await saveMatchReportDraftSafe(dto, report)
    expect(isServiceSuccess(result)).toBe(false)
    if (!isServiceSuccess(result)) {
      expect(result.error.retryable).toBe(false)
      expect(result.error.shouldBlock).toBe(true)
    }
  })

  it('assertQaRuntimeSimulation consume flag (no loop infinito)', () => {
    __setQaRuntimeFlagsForTest({ failLoadOnce: true })
    expect(() => assertQaRuntimeSimulation('load')).toThrow(/simulated load/)
    expect(() => assertQaRuntimeSimulation('load')).not.toThrow()
  })

  it('executeWithRetry no reintenta errores QA (retry manual en UI)', async () => {
    const fn = vi.fn().mockImplementation(() => {
      throw createQaSimulatedError('save', 'recoverable')
    })
    await expect(executeWithRetry(fn, 'saveDraft', { maxAttempts: 3, delayMs: 1 })).rejects.toThrow(
      /\[ETR7_QA\]/,
    )
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('errores QA recoverable mapean a TIMEOUT retryable', () => {
    const err = normalizeOperationError(createQaSimulatedError('save', 'recoverable'))
    expect(err.code).toBe('TIMEOUT')
    expect(err.retryable).toBe(true)
    expect(isQaSimulatedError(createQaSimulatedError('save', 'recoverable'))).toBe(true)
  })

  it('failFinalizeOnce y segundo close OK', async () => {
    const { closeMatchReportSafe } = await import('../services/matchReport.service.wrapped')
    __setQaRuntimeFlagsForTest({ failFinalizeOnce: true })
    const report = emptyMatchReport()
    const dto = buildMatchPersistenceDto(report, true)

    const first = await closeMatchReportSafe(dto, report)
    expect(isServiceSuccess(first)).toBe(false)

    const second = await closeMatchReportSafe(dto, report)
    expect(isServiceSuccess(second)).toBe(true)
    if (isServiceSuccess(second)) {
      expect(second.data.cerrada).toBe(true)
    }
  })
})
