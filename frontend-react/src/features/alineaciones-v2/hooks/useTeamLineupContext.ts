import { useCallback, useEffect, useState } from 'react'
import type { TeamLineupContextRequest, TeamLineupContextWire } from '../contracts/teamLineupContext.contract'
import { teamLineupContextService } from '../services/teamLineupContext.service'

export interface TeamLineupRefetchOptions {
  /** Si true, no activa loading global ni oculta la UI durante la recarga. */
  readonly background?: boolean
}

export interface UseTeamLineupContextState {
  readonly data: TeamLineupContextWire | null
  readonly loading: boolean
  readonly error: Error | null
  readonly refetch: (options?: TeamLineupRefetchOptions) => Promise<TeamLineupContextWire | null>
}

/**
 * Carga/refetch del boundary GET. Tras SAVE/CONFIRM usar `reconcileLineupDraftFromWire`
 * con el wire devuelto por `refetch({ background: true })` para alinear draft y runtime.
 * `metadata.etag` viaja en la respuesta pero no se valida en cliente (reservado Fase 3+).
 */
export function useTeamLineupContext(request: TeamLineupContextRequest | null): UseTeamLineupContextState {
  const [data, setData] = useState<TeamLineupContextWire | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(
    async (options?: TeamLineupRefetchOptions): Promise<TeamLineupContextWire | null> => {
      if (!request) {
        setData(null)
        setError(null)
        return null
      }
      const background = options?.background === true
      if (!background) {
        setLoading(true)
      }
      setError(null)
      try {
        const res = await teamLineupContextService.getContext(request)
        setData(res)
        return res
      } catch (e) {
        setData(null)
        setError(e instanceof Error ? e : new Error(String(e)))
        return null
      } finally {
        if (!background) {
          setLoading(false)
        }
      }
    },
    [request],
  )

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
