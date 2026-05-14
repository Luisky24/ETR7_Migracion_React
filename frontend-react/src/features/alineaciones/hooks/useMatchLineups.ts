import { useCallback, useEffect, useState } from 'react'
import type { MatchLineupsQuery, MatchLineupsResponse } from '../contracts/alineaciones.contract'
import { alineacionesService } from '../services/alineaciones.service'

export interface UseMatchLineupsResult {
  readonly data: MatchLineupsResponse | null
  readonly loading: boolean
  readonly error: Error | null
  readonly refetch: () => Promise<void>
}

/**
 * Carga alineaciones read-only para un encuentro (clave de calendario + filtros competición).
 */
export function useMatchLineups(query: MatchLineupsQuery | null): UseMatchLineupsResult {
  const [data, setData] = useState<MatchLineupsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!query || !query.recordKey.trim()) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await alineacionesService.getMatchLineups({
        categoria: query.categoria,
        fase: query.fase,
        recordKey: query.recordKey,
      })
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refetch()
    }, 0)
    return () => {
      window.clearTimeout(handle)
    }
  }, [refetch])

  return { data, loading, error, refetch }
}
