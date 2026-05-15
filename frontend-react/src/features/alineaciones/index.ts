/**
 * Alineaciones — lectura dual por encuentro (`/calendar/lineups`).
 * @see ./README.md
 */

export { MatchLineupsPage } from './pages/MatchLineupsPage'
export { useMatchLineups } from './hooks/useMatchLineups'
export type {
  MatchLineupPlayerDto,
  MatchLineupTeamDto,
  MatchLineupsQuery,
  MatchLineupsResponse,
} from './contracts/alineaciones.contract'
export { alineacionesService } from './services/alineaciones.service'
