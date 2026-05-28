import { useCallback, useEffect, useState } from 'react'
import type { CalendarCategory, CalendarMatchDto, CalendarPhase } from '../contracts/calendar.contract'
import { calendarService } from '../services/calendar.service'

export interface UseCalendarMatchByRecordKeyResult {
  readonly match: CalendarMatchDto | null
  readonly loading: boolean
  readonly error: Error | null
  readonly refetch: () => Promise<void>
}

/**
 * A4: resolver de contexto runtime a partir del `recordKey` del calendario.
 * Hook mínimo: carga lista de matches y selecciona uno por `recordKey`.
 */
export function useCalendarMatchByRecordKey(input: {
  readonly categoria: CalendarCategory
  readonly fase: CalendarPhase
  readonly recordKey: string
} | null): UseCalendarMatchByRecordKeyResult {
  const [match, setMatch] = useState<CalendarMatchDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!input) {
      setMatch(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await calendarService.getMatches({
        categoria: input.categoria,
        fase: input.fase,
        grupo: '',
        searchText: '',
      })
      const found = res.matchesByEncuentroId[input.recordKey] ?? null
      setMatch(found)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [input])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refetch()
    }, 0)
    return () => window.clearTimeout(handle)
  }, [refetch])

  return { match, loading, error, refetch }
}

