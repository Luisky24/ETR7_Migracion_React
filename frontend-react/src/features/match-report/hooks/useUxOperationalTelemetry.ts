import { useEffect, useRef } from 'react'
import type { MatchReportState } from '../types/matchReportState.types'
import { selectIsSuperseded, selectRuntimeStaleState } from '../selectors/matchReportDocumentSelectors'
import { logUxOperational } from '../ux/uxOperationalLogger'

/**
 * A5 — Registra en consola (staging/DEV) cuando banners UX operacionales son visibles.
 */
export function useUxOperationalTelemetry(state: MatchReportState): void {
  const superseded = selectIsSuperseded(state)
  const stale = selectRuntimeStaleState(state)
  const concurrent = state.operationError?.code === 'DOCUMENT_VERSION_CONFLICT'
  const recovery = state.recovery

  const last = useRef({ superseded: false, stale: false, concurrent: false })

  useEffect(() => {
    const matchId = state.context?.encuentroId
    if (superseded && !last.current.superseded) {
      logUxOperational('SUPERSEDED', 'banner.visible', { matchId })
    }
    if (stale?.isStale && !last.current.stale) {
      logUxOperational('STALE', 'banner.visible', { matchId, kinds: stale.kinds })
    }
    if (concurrent && !last.current.concurrent) {
      logUxOperational('CONCURRENT', 'banner.visible', { matchId })
    }
    if (recovery?.shouldReload && state.operationError) {
      logUxOperational('RECOVERY', 'reloadRequired', {
        matchId,
        code: state.operationError.code,
        preserveDirty: recovery.preserveDirty,
      })
    }
    last.current = { superseded, stale: stale?.isStale === true, concurrent }
  }, [state, superseded, stale, concurrent, recovery])
}
