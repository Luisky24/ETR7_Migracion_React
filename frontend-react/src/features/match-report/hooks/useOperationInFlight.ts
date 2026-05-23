import { useCallback, useMemo, useRef } from 'react'
import { normalizedDuplicateOperationError } from '../utils/errorNormalizer'

export interface OperationInFlightApi {
  readonly tryAcquire: (key: string) => boolean
  readonly release: (key: string) => void
  readonly duplicateError: () => ReturnType<typeof normalizedDuplicateOperationError>
}

/** Evita operaciones async duplicadas (guardado/cierre/carga simultáneos). */
export function useOperationInFlight(): OperationInFlightApi {
  const ref = useRef<string | null>(null)

  const tryAcquire = useCallback((key: string): boolean => {
    if (ref.current != null) return false
    ref.current = key
    return true
  }, [])

  const release = useCallback((key: string) => {
    if (ref.current === key) ref.current = null
  }, [])

  const duplicateError = useCallback(() => normalizedDuplicateOperationError(), [])

  return useMemo(
    () => ({ tryAcquire, release, duplicateError }),
    [tryAcquire, release, duplicateError],
  )
}
