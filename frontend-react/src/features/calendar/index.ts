/**
 * API pública del feature Calendario (vertical slice lectura).
 */

export type {
  CalendarCategory,
  CalendarPhase,
  CalendarMatchState,
  CalendarMatchDto,
  CalendarMatchesResponse,
  CalendarFilters,
} from './contracts/calendar.contract'

export type { CalendarMatch } from './types/calendar-domain.types'

export { calendarService } from './services/calendar.service'
export { useCalendarMatches } from './hooks/useCalendarMatches'
export type { UseCalendarMatchesResult } from './hooks/useCalendarMatches'

export { CalendarMatchesPage } from './pages/CalendarMatchesPage'
