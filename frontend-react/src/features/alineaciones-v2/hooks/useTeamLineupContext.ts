import { useCallback, useEffect, useState } from 'react'
import type { TeamLineupContextRequest, TeamLineupContextWire } from '../contracts/teamLineupContext.contract'
import { teamLineupContextService } from '../services/teamLineupContext.service'

export interface UseTeamLineupContextState {
  readonly data: TeamLineupContextWire | null
  readonly loading: boolean
  readonly error: Error | null
  readonly refetch: () => Promise<void>
}

export function useTeamLineupContext(request: TeamLineupContextRequest | null): UseTeamLineupContextState {
  const [data, setData] = useState<TeamLineupContextWire | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!request) {
      setData(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await teamLineupContextService.getContext(request)
      setData(res)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
