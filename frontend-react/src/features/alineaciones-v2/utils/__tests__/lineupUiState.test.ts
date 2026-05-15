import { describe, expect, it } from 'vitest'
import { computeLineupUiState } from '../lineupRuntimeState'
import { flags, permissions, workflow } from './lineupTestFixtures'

describe('computeLineupUiState', () => {
  it('pendiente y en curso editables con permisos', () => {
    const pending = computeLineupUiState(workflow({ teamSlotState: 'P' }), flags(), permissions())
    expect(pending.badgeLabel).toBe('Pendiente')
    expect(pending.badgeTone).toBe('amber')
    expect(pending.isLockedLineup).toBe(false)

    const enCurso = computeLineupUiState(workflow({ teamSlotState: 'E' }), flags(), permissions())
    expect(enCurso.badgeLabel).toBe('En curso')
    expect(enCurso.badgeTone).toBe('sky')
    expect(enCurso.isLockedLineup).toBe(false)
  })

  it('confirmada bloquea edición', () => {
    const state = computeLineupUiState(workflow({ teamSlotState: 'C' }), flags(), permissions())
    expect(state.badgeLabel).toBe('Confirmada')
    expect(state.badgeTone).toBe('emerald')
    expect(state.isLockedLineup).toBe(true)
    expect(state.lockReason).toContain('confirmada')
  })

  it('prioriza acta cerrada sobre confirmada', () => {
    const state = computeLineupUiState(
      workflow({ teamSlotState: 'C', matchState: 'acta_cerrada' }),
      flags(),
      permissions(),
    )
    expect(state.badgeLabel).toBe('Acta cerrada')
    expect(state.isLockedLineup).toBe(true)
  })

  it('acta abierta bloquea con badge dedicado aunque slot sea confirmado', () => {
    const state = computeLineupUiState(
      workflow({ teamSlotState: 'C', matchState: 'acta_abierta' }),
      flags(),
      permissions(),
    )
    expect(state.badgeLabel).toBe('Acta abierta')
    expect(state.isLockedLineup).toBe(true)
    expect(state.lockReason).toContain('acta')
  })

  it('cerradaPorActa en flags muestra acta cerrada', () => {
    const state = computeLineupUiState(
      workflow({ teamSlotState: 'P' }),
      flags({ cerradaPorActa: true }),
      permissions(),
    )
    expect(state.badgeLabel).toBe('Acta cerrada')
    expect(state.isLockedLineup).toBe(true)
  })

  it('hoja ENC confirmada bloquea aunque slot no sea C', () => {
    const state = computeLineupUiState(
      workflow({ teamSlotState: 'E', sheetStateEnc: 'c' }),
      flags(),
      permissions(),
    )
    expect(state.badgeLabel).toBe('Confirmada')
    expect(state.isLockedLineup).toBe(true)
  })

  it('sin permisos muestra solo lectura aunque slot sea en curso', () => {
    const state = computeLineupUiState(
      workflow({ teamSlotState: 'E' }),
      flags(),
      permissions({ canEdit: false }),
    )
    expect(state.badgeLabel).toBe('Solo lectura')
    expect(state.isLockedLineup).toBe(true)
    expect(state.lockReason).toContain('permiso')
  })

  it('slot F muestra cerrada', () => {
    const state = computeLineupUiState(workflow({ teamSlotState: 'F' }), flags(), permissions())
    expect(state.badgeLabel).toBe('Cerrada')
    expect(state.isLockedLineup).toBe(true)
  })
})
