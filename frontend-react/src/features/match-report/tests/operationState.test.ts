import { describe, expect, it } from 'vitest'
import {
  canStartFinalize,
  canStartLoad,
  canStartSave,
  isOperationBusy,
  operationForEdit,
  operationForFinalizeFailure,
  operationForFinalizeSuccess,
  operationForLoadSuccess,
  operationForSaveFailure,
  operationForSaveSuccess,
} from '../domain/operationState'
import { emptyMatchReport } from './fixtures'

describe('operationState', () => {
  it('busy during loading/saving/finalizing', () => {
    expect(isOperationBusy('loading')).toBe(true)
    expect(isOperationBusy('saving')).toBe(true)
    expect(isOperationBusy('finalizing')).toBe(true)
    expect(isOperationBusy('loaded')).toBe(false)
  })

  it('load success → loaded or locked', () => {
    const open = emptyMatchReport()
    expect(operationForLoadSuccess(open, false)).toBe('loaded')
    const closed = { ...open, cerrada: true, editability: 'read_only' as const }
    expect(operationForLoadSuccess(closed, true)).toBe('locked')
  })

  it('save failure preserves loaded when report exists', () => {
    expect(operationForSaveFailure(true)).toBe('loaded')
    expect(operationForSaveFailure(false)).toBe('error')
  })

  it('edit from saved → loaded', () => {
    expect(operationForEdit('saved')).toBe('loaded')
    expect(operationForEdit('locked')).toBe('locked')
  })

  it('finalize success → finalized', () => {
    expect(operationForFinalizeSuccess()).toBe('finalized')
  })

  it('finalize failure with report → loaded', () => {
    expect(operationForFinalizeFailure(true)).toBe('loaded')
  })

  it('canStartSave only in safe states', () => {
    expect(canStartSave('loaded')).toBe(true)
    expect(canStartSave('saving')).toBe(false)
  })

  it('canStartFinalize from loaded or saved', () => {
    expect(canStartFinalize('loaded')).toBe(true)
    expect(canStartFinalize('saved')).toBe(true)
    expect(canStartFinalize('loading')).toBe(false)
  })

  it('canStartLoad from idle and error', () => {
    expect(canStartLoad('idle')).toBe(true)
    expect(canStartLoad('error')).toBe(true)
  })

  it('save success → saved', () => {
    expect(operationForSaveSuccess(false)).toBe('saved')
    expect(operationForSaveSuccess(true)).toBe('locked')
  })
})
