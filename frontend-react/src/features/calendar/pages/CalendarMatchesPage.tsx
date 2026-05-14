import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { hasCapability } from '@/contracts/capabilities.contract'
import { useSession } from '@/contexts/SessionContext'
import { ROUTES } from '@/router/routes'
import { CalendarEmptyState } from '../components/CalendarEmptyState'
import { CalendarErrorState } from '../components/CalendarErrorState'
import { CalendarFiltersBar } from '../components/CalendarFiltersBar'
import { CalendarLoadingState } from '../components/CalendarLoadingState'
import { CalendarMatchesTable } from '../components/CalendarMatchesTable'
import type { CalendarCategory, CalendarFilters, CalendarPhase } from '../contracts/calendar.contract'
import { useCalendarMatches } from '../hooks/useCalendarMatches'

export function CalendarMatchesPage() {
  const { state } = useSession()
  const [categoria, setCategoria] = useState<CalendarCategory>('M')
  const [fase, setFase] = useState<CalendarPhase>('Fase I')

  const filters: CalendarFilters = useMemo(
    () => ({
      categoria,
      fase,
    }),
    [categoria, fase],
  )

  const { data, loading, error, refetch } = useCalendarMatches(filters)

  if (state.status !== 'authenticated') {
    return null
  }

  if (!hasCapability(state.user.capabilities, 'canAccessCalendar')) {
    return <Navigate to={ROUTES.menu} replace />
  }

  const matches = data ? Object.values(data.matchesByEncuentroId) : []
  const showTable = !loading && !error && matches.length > 0
  const showEmpty = !loading && !error && data !== null && matches.length === 0

  return (
    <article className="page-card max-w-6xl">
      <header className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Calendario</h1>
          <p className="mt-1 text-sm text-slate-600">
            Encuentros (solo lectura). Los datos provienen del servidor de competición.
          </p>
        </div>
        <Link
          to={ROUTES.menu}
          className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          Volver al menú
        </Link>
      </header>

      <div className="mt-6 space-y-6">
        <CalendarFiltersBar
          filters={filters}
          loading={loading}
          onCategoryChange={setCategoria}
          onPhaseChange={setFase}
          onRefresh={() => {
            void refetch(filters)
          }}
        />

        {loading ? <CalendarLoadingState /> : null}
        {!loading && error ? (
          <CalendarErrorState message={error.message} onRetry={() => void refetch(filters)} />
        ) : null}
        {showEmpty ? <CalendarEmptyState /> : null}
        {showTable ? <CalendarMatchesTable matches={matches} calendarFilters={filters} /> : null}
      </div>
    </article>
  )
}
