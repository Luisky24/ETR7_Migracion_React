/**
 * Dominio puro alineación (sin React). Tests en `utils/__tests__/`.
 */

export {
  LINEUP_CONFIRM_MAX_SUPLENTES,
  LINEUP_CONFIRM_REQUIRED_CAPITANES,
  LINEUP_CONFIRM_REQUIRED_TITULARES,
  LINEUP_DORSAL_MAX,
  LINEUP_DORSAL_MIN,
} from '../utils/lineupDomain.constants'

export {
  computeLineupConfirmBlockingErrors,
  type LineupConfirmValidationInput,
} from '../utils/lineupConfirmValidation'

export { areLineupDraftsEqual, cloneLineupDraft } from '../utils/lineupDraftCompare'

export {
  computeDuplicateDorsals,
  isDorsalInvalidForPlayer,
  normalizePlayerRosterRoles,
  parseDorsalInput,
  setPlayerDorsal,
  toggleCapitan,
  toggleSuplente,
  toggleTitular,
} from '../utils/lineupPlayerPatch'

export { computeLineupSoftWarnings } from '../utils/lineupSoftWarnings'

export {
  computeLineupRuntimeState,
  computeLineupRuntimeStateFromResponse,
  computeLineupUiState,
  resolveLineupOperationalPhase,
  type LineupBadgeTone,
  type LineupLockSource,
  type LineupOperationalPhase,
  type LineupRuntimeInput,
  type LineupRuntimeState,
  type LineupUiState,
} from '../utils/lineupRuntimeState'

export {
  lineupDraftFromContext,
  reconcileLineupDraftFromWire,
  type LineupReconcileResult,
} from '../utils/lineupReconcile'

export type { TeamLineupDraftState } from '../types/teamLineupDraft.types'
