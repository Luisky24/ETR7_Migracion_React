import { useCallback, useEffect, useState } from 'react'
import type { CalendarFilters, CalendarMatchesResponse } from '../contracts/calendar.contract'
import { calendarService } from '../services/calendar.service'

export interface UseCalendarMatchesResult {
  readonly data: CalendarMatchesResponse | null
  readonly loading: boolean
  readonly error: Error | null
  /** Debe recibir los filtros efectivos (p. ej. los mismos que el hook o una variante). */
  readonly refetch: (next: CalendarFilters) => Promise<void>
}

/**
 * Hook mínimo de lectura: carga inicial + refetch explícito.
 * Sin caché avanzada ni librerías de datos.
 */
export function useCalendarMatches(filters: CalendarFilters): UseCalendarMatchesResult {
  const [data, setData] = useState<CalendarMatchesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async (next: CalendarFilters) => {
    setLoading(true)
    setError(null)
    try {
      const res = await calendarService.getMatches(next)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const snapshot: CalendarFilters = filters
    const handle = window.setTimeout(() => {
      void refetch(snapshot)
    }, 0)
    return () => {
      window.clearTimeout(handle)
    }
    // Dep. primitivos: evitar re-fetch en bucle si el caller pasa un objeto `filters` nuevo cada render.
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot alinea con campos de `CalendarFilters` (primitivos arriba)
  [refetch, filters.categoria, filters.fase, filters.grupo, filters.searchText])

  return { data, loading, error, refetch }
}
