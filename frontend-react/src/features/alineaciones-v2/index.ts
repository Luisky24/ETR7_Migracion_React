/**
 * Alineaciones — contexto editable por equipo (`/calendar/team-lineup-context`).
 * @see ./README.md
 */

export { TeamLineupContextPage } from './pages/TeamLineupContextPage'

export { useTeamLineupContext } from './hooks/useTeamLineupContext'
export type { TeamLineupRefetchOptions, UseTeamLineupContextState } from './hooks/useTeamLineupContext'
export { useLineupUnsavedGuard } from './hooks/useLineupUnsavedGuard'
export { useLineupConfirmRedirect } from './hooks/useLineupConfirmRedirect'

export type {
  TeamLineupCalendarSlotState,
  TeamLineupConfirmRequest,
  TeamLineupContextDto,
  TeamLineupContextRequest,
  TeamLineupContextResponse,
  TeamLineupContextWire,
  TeamLineupMatchState,
  TeamLineupPermissionsDto,
  TeamLineupPlayerDto,
  TeamLineupSaveRequest,
  TeamLineupWorkflowStateDto,
} from './contracts/teamLineupContext.contract'

export { teamLineupContextService } from './services/teamLineupContext.service'

export {
  buildTeamLineupConfirmRequest,
  buildTeamLineupContextSearchParams,
  buildTeamLineupSaveRequest,
  teamLineupContextRequestFromSearchParams,
} from './utils/teamLineupContextQuery'

export { legacyNivelAccesoFromRole } from './utils/legacyAccessLevel'
export { sessionOperationalTeamName } from './utils/sessionTeam'

export type { TeamLineupDraftState } from './types/teamLineupDraft.types'

export * from './domain'
