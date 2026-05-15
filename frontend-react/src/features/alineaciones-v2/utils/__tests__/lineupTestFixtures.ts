import type {
  TeamLineupContextFlagsDto,
  TeamLineupPermissionsDto,
  TeamLineupPlayerDto,
  TeamLineupWorkflowStateDto,
} from '../../contracts/teamLineupContext.contract'
import type { TeamLineupDraftState } from '../../types/teamLineupDraft.types'

export function player(
  nombre: string,
  overrides: Partial<TeamLineupPlayerDto> = {},
): TeamLineupPlayerDto {
  return {
    nombre,
    titular: false,
    suplente: false,
    capitan: false,
    dorsal: null,
    ...overrides,
  }
}

export function draft(overrides: Partial<TeamLineupDraftState> = {}): TeamLineupDraftState {
  return {
    delegado: '',
    entrenador: '',
    jugadores: [],
    ...overrides,
  }
}

export function workflow(
  overrides: Partial<TeamLineupWorkflowStateDto> = {},
): TeamLineupWorkflowStateDto {
  return {
    teamSlotState: 'P',
    opponentSlotState: 'P',
    matchState: 'sin_alineacion',
    sheetStateEnc: null,
    ...overrides,
  }
}

export function permissions(
  overrides: Partial<TeamLineupPermissionsDto> & { readonly canEdit?: boolean } = {},
): TeamLineupPermissionsDto {
  const canEdit = overrides.canEdit ?? true
  return {
    canRead: true,
    canEdit,
    canConfirm: overrides.canConfirm ?? canEdit,
    canSelectTeam: false,
    protectedMode: overrides.protectedMode ?? !canEdit,
    reasonCodes: [],
    ...overrides,
  }
}

export function flags(overrides: Partial<TeamLineupContextFlagsDto> = {}): TeamLineupContextFlagsDto {
  return {
    fromActaSnapshot: false,
    cerradaPorActa: false,
    staleRiskEncVsCalendar: false,
    ...overrides,
  }
}

/** Siete titulares + un suplente con dorsales únicos y un capitán (válido para confirmación). */
export function validConfirmRoster(): TeamLineupPlayerDto[] {
  const titulares = Array.from({ length: 7 }, (_, i) =>
    player(`Titular ${String(i + 1)}`, {
      titular: true,
      dorsal: i + 1,
      capitan: i === 0,
    }),
  )
  return [...titulares, player('Suplente 1', { suplente: true, dorsal: 8 })]
}
