import { describe, expect, it } from 'vitest'
import type { TeamLineupContextResponse } from '../../contracts/teamLineupContext.contract'
import {
  computeLineupRuntimeState,
  computeLineupRuntimeStateFromResponse,
  resolveLineupOperationalPhase,
} from '../lineupRuntimeState'
import { flags, permissions, workflow } from './lineupTestFixtures'

function minimalResponse(
  overrides: Partial<{
    workflow: ReturnType<typeof workflow>
    flags: ReturnType<typeof flags>
    permissions: ReturnType<typeof permissions>
    etag: string | null
  }> = {},
): TeamLineupContextResponse {
  return {
    ok: true,
    context: {
      match: {
        categoria: 'M',
        fase: 'Fase I',
        grupo: 'G1',
        equipoLocal: 'A',
        equipoVisitante: 'B',
        encuentroLabel: 'A - B',
        hora: null,
        campo: null,
        referenciaEncuentro: null,
        numFilaCalendario: null,
      },
      equipoOperativo: 'A',
      indLocalVisitante: 'L',
      contrario: 'B',
      delegado: '',
      entrenador: '',
      jugadores: [],
      nivelAcceso: 7,
      role: 'team',
      origenModelo: 'test',
    },
    permissions: overrides.permissions ?? permissions(),
    workflow: overrides.workflow ?? workflow(),
    flags: overrides.flags ?? flags(),
    metadata: {
      version: 2,
      serverTime: '2026-01-01T00:00:00.000Z',
      etag: overrides.etag ?? 'etag-test-1',
    },
  }
}

describe('resolveLineupOperationalPhase', () => {
  it('prioridad acta abierta sobre confirmada en calendario', () => {
    expect(
      resolveLineupOperationalPhase(
        workflow({ teamSlotState: 'C', matchState: 'acta_abierta' }),
        flags(),
        permissions(),
      ),
    ).toBe('acta_abierta')
  })

  it('protectedMode con canEdit true fuerza fase solo lectura', () => {
    expect(
      resolveLineupOperationalPhase(
        workflow({ teamSlotState: 'E' }),
        flags(),
        permissions({ canEdit: true, protectedMode: true }),
      ),
    ).toBe('locked_permissions')
  })
})

describe('computeLineupRuntimeState', () => {
  it('acta abierta + slot C: bloqueado y fase acta', () => {
    const runtime = computeLineupRuntimeState({
      workflow: workflow({ teamSlotState: 'C', matchState: 'acta_abierta' }),
      flags: flags(),
      permissions: permissions(),
    })
    expect(runtime.phase).toBe('acta_abierta')
    expect(runtime.ui.isLockedLineup).toBe(true)
    expect(runtime.canEditFields).toBe(false)
    expect(runtime.lockSources).toContain('acta_abierta')
    expect(runtime.lockSources).toContain('slot_confirmado')
  })

  it('canEdit false + slot E: solo lectura sin ofrecer guardar', () => {
    const runtime = computeLineupRuntimeState({
      workflow: workflow({ teamSlotState: 'E' }),
      flags: flags(),
      permissions: permissions({ canEdit: false }),
    })
    expect(runtime.phase).toBe('locked_permissions')
    expect(runtime.canOfferSave).toBe(false)
    expect(runtime.canOfferConfirm).toBe(false)
    expect(runtime.lockSources).toContain('sin_permiso_edicion')
  })

  it('ENC C inconsistente con slot E: confirmada y bloqueada', () => {
    const runtime = computeLineupRuntimeState({
      workflow: workflow({ teamSlotState: 'E', sheetStateEnc: 'C' }),
      flags: flags(),
      permissions: permissions(),
    })
    expect(runtime.phase).toBe('confirmada')
    expect(runtime.ui.isLockedLineup).toBe(true)
    expect(runtime.lockSources).toContain('sheet_enc_confirmada')
  })

  it('editable en curso tras save parcial (slot E)', () => {
    const runtime = computeLineupRuntimeState({
      workflow: workflow({ teamSlotState: 'E' }),
      flags: flags(),
      permissions: permissions(),
    })
    expect(runtime.phase).toBe('en_curso')
    expect(runtime.canEditFields).toBe(true)
    expect(runtime.canOfferSave).toBe(true)
    expect(runtime.ui.isLockedLineup).toBe(false)
  })

  it('propaga etag sin usarlo para locking', () => {
    const runtime = computeLineupRuntimeStateFromResponse(
      minimalResponse({ etag: 'rev-42', workflow: workflow({ teamSlotState: 'P' }) }),
    )
    expect(runtime.serverEtag).toBe('rev-42')
    expect(runtime.canEditFields).toBe(true)
  })

  it('reload post-confirmación: slot C bloquea acciones', () => {
    const runtime = computeLineupRuntimeStateFromResponse(
      minimalResponse({
        workflow: workflow({ teamSlotState: 'C' }),
        permissions: permissions({ canEdit: true, canConfirm: true, protectedMode: true }),
      }),
    )
    expect(runtime.phase).toBe('confirmada')
    expect(runtime.ui.badgeLabel).toBe('Confirmada')
    expect(runtime.canOfferConfirm).toBe(false)
    expect(runtime.lockSources).toContain('protected_mode')
  })
})
