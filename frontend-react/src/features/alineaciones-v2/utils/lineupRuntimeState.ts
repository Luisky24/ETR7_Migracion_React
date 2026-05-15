/**
 * Runtime operativo derivado del wire GAS (badge, lock, acciones).
 * Única fuente de verdad en cliente; no duplicar en componentes.
 * @module alineaciones-v2/runtime
 */
import type {
  TeamLineupCalendarSlotState,
  TeamLineupContextFlagsDto,
  TeamLineupContextResponse,
  TeamLineupMatchState,
  TeamLineupPermissionsDto,
  TeamLineupWorkflowStateDto,
} from '../contracts/teamLineupContext.contract'

export type LineupBadgeTone = 'amber' | 'sky' | 'emerald' | 'slate' | 'rose'

/**
 * Fase operativa visible (prioridad estricta, de mayor a menor restricción):
 * 1 acta_cerrada → 2 acta_abierta → 3 confirmada → 4 locked_permissions → 5 en_curso → 6 pendiente.
 * `slot_cerrada` (calendario F) comparte bloqueo con confirmada pero badge propio.
 */
export type LineupOperationalPhase =
  | 'acta_cerrada'
  | 'acta_abierta'
  | 'confirmada'
  | 'slot_cerrada'
  | 'locked_permissions'
  | 'en_curso'
  | 'pendiente'
  | 'sin_alineacion'

export type LineupLockSource =
  | 'acta_cerrada'
  | 'acta_abierta'
  | 'slot_confirmado'
  | 'sheet_enc_confirmada'
  | 'slot_cerrada'
  | 'protected_mode'
  | 'sin_permiso_edicion'

/** Subconjunto estable para header y panel (sin cambiar markup existente). */
export interface LineupUiState {
  readonly isLockedLineup: boolean
  readonly badgeLabel: string
  readonly badgeTone: LineupBadgeTone
  readonly lockReason: string | null
}

export interface LineupRuntimeInput {
  readonly workflow: TeamLineupWorkflowStateDto
  readonly flags: TeamLineupContextFlagsDto
  readonly permissions: TeamLineupPermissionsDto
  /** Reservado Fase 3+: concurrencia optimista; no usado en Fase 2.2. */
  readonly serverEtag?: string | null
}

export interface LineupRuntimeState {
  readonly phase: LineupOperationalPhase
  readonly ui: LineupUiState
  readonly canEditFields: boolean
  readonly canOfferSave: boolean
  readonly canOfferConfirm: boolean
  readonly lockSources: readonly LineupLockSource[]
  /** Copia del etag del último GET; reservado, sin locking optimista. */
  readonly serverEtag: string | null
}

const SLOT_LABEL: Record<TeamLineupCalendarSlotState, string> = {
  P: 'Pendiente',
  E: 'En curso',
  C: 'Confirmada',
  F: 'Cerrada',
  EMPTY: 'Sin alineación',
}

const PHASE_BADGE: Record<
  LineupOperationalPhase,
  { readonly label: string; readonly tone: LineupBadgeTone; readonly lockReason: string }
> = {
  acta_cerrada: {
    label: 'Acta cerrada',
    tone: 'slate',
    lockReason: 'El encuentro tiene el acta cerrada. La alineación no se puede modificar.',
  },
  acta_abierta: {
    label: 'Acta abierta',
    tone: 'slate',
    lockReason: 'El acta está abierta. La alineación queda bloqueada para edición.',
  },
  confirmada: {
    label: 'Confirmada',
    tone: 'emerald',
    lockReason: 'Alineación confirmada. No se puede editar.',
  },
  slot_cerrada: {
    label: 'Cerrada',
    tone: 'slate',
    lockReason: 'Alineación cerrada. No se puede editar.',
  },
  locked_permissions: {
    label: 'Solo lectura',
    tone: 'slate',
    lockReason: 'No tiene permiso para editar esta alineación.',
  },
  en_curso: {
    label: 'En curso',
    tone: 'sky',
    lockReason: '',
  },
  pendiente: {
    label: 'Pendiente',
    tone: 'amber',
    lockReason: '',
  },
  sin_alineacion: {
    label: 'Sin alineación',
    tone: 'slate',
    lockReason: '',
  },
}

function isActaCerrada(matchState: TeamLineupMatchState, flags: TeamLineupContextFlagsDto): boolean {
  return matchState === 'acta_cerrada' || flags.cerradaPorActa
}

function isActaAbierta(matchState: TeamLineupMatchState): boolean {
  return matchState === 'acta_abierta'
}

function isSheetEncConfirmed(sheetStateEnc: string | null | undefined): boolean {
  return sheetStateEnc?.trim().toUpperCase() === 'C'
}

function isSlotConfirmed(teamSlotState: TeamLineupCalendarSlotState): boolean {
  return teamSlotState === 'C'
}

function collectLockSources(
  workflow: TeamLineupWorkflowStateDto,
  flags: TeamLineupContextFlagsDto,
  permissions: TeamLineupPermissionsDto,
): LineupLockSource[] {
  const sources: LineupLockSource[] = []
  if (isActaCerrada(workflow.matchState, flags)) {
    sources.push('acta_cerrada')
  }
  if (isActaAbierta(workflow.matchState)) {
    sources.push('acta_abierta')
  }
  if (isSlotConfirmed(workflow.teamSlotState)) {
    sources.push('slot_confirmado')
  }
  if (isSheetEncConfirmed(workflow.sheetStateEnc)) {
    sources.push('sheet_enc_confirmada')
  }
  if (workflow.teamSlotState === 'F') {
    sources.push('slot_cerrada')
  }
  if (permissions.protectedMode) {
    sources.push('protected_mode')
  }
  if (!permissions.canEdit) {
    sources.push('sin_permiso_edicion')
  }
  return sources
}

function isWorkflowLocked(sources: readonly LineupLockSource[]): boolean {
  return sources.some(
    (s) =>
      s === 'acta_cerrada' ||
      s === 'acta_abierta' ||
      s === 'slot_confirmado' ||
      s === 'sheet_enc_confirmada' ||
      s === 'slot_cerrada',
  )
}

/**
 * Prioridad de badge/fase operativa (no implica que el lock sea solo por esa causa).
 */
export function resolveLineupOperationalPhase(
  workflow: TeamLineupWorkflowStateDto,
  flags: TeamLineupContextFlagsDto,
  permissions: TeamLineupPermissionsDto,
): LineupOperationalPhase {
  const { teamSlotState, matchState } = workflow

  if (isActaCerrada(matchState, flags)) {
    return 'acta_cerrada'
  }
  if (isActaAbierta(matchState)) {
    return 'acta_abierta'
  }
  if (isSlotConfirmed(teamSlotState) || isSheetEncConfirmed(workflow.sheetStateEnc)) {
    return 'confirmada'
  }
  if (teamSlotState === 'F') {
    return 'slot_cerrada'
  }
  if (!permissions.canEdit || permissions.protectedMode) {
    return 'locked_permissions'
  }
  if (teamSlotState === 'E') {
    return 'en_curso'
  }
  if (teamSlotState === 'P') {
    return 'pendiente'
  }
  return 'sin_alineacion'
}

export function computeLineupRuntimeState(input: LineupRuntimeInput): LineupRuntimeState {
  const { workflow, flags, permissions } = input
  const lockSources = collectLockSources(workflow, flags, permissions)
  const workflowLocked = isWorkflowLocked(lockSources)
  const permissionOnlyLocked =
    lockSources.includes('sin_permiso_edicion') || lockSources.includes('protected_mode')
  const isLockedLineup = workflowLocked || permissionOnlyLocked

  const phase = resolveLineupOperationalPhase(workflow, flags, permissions)
  const badgeDef = PHASE_BADGE[phase]
  const badgeLabel =
    phase === 'pendiente' || phase === 'en_curso' || phase === 'sin_alineacion'
      ? (SLOT_LABEL[workflow.teamSlotState] ?? badgeDef.label)
      : badgeDef.label

  let lockReason: string | null = badgeDef.lockReason || null
  if (isLockedLineup && !lockReason) {
    lockReason = 'La alineación no está disponible para edición.'
  }

  const ui: LineupUiState = {
    isLockedLineup,
    badgeLabel,
    badgeTone: badgeDef.tone,
    lockReason,
  }

  const canEditFields = permissions.canEdit && !isLockedLineup
  const canOfferSave = permissions.canEdit && !isLockedLineup
  const canOfferConfirm = permissions.canConfirm && !isLockedLineup

  return {
    phase,
    ui,
    canEditFields,
    canOfferSave,
    canOfferConfirm,
    lockSources,
    serverEtag: input.serverEtag ?? null,
  }
}

export function computeLineupRuntimeStateFromResponse(
  response: TeamLineupContextResponse,
): LineupRuntimeState {
  return computeLineupRuntimeState({
    workflow: response.workflow,
    flags: response.flags,
    permissions: response.permissions,
    serverEtag: response.metadata.etag,
  })
}

/** Compatibilidad: derivación UI desde permisos parciales (preferir respuesta completa). */
export function computeLineupUiState(
  workflow: TeamLineupWorkflowStateDto,
  flags: TeamLineupContextFlagsDto,
  permissions: TeamLineupPermissionsDto,
): LineupUiState {
  return computeLineupRuntimeState({ workflow, flags, permissions }).ui
}
