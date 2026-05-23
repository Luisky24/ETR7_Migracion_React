import { useRef } from 'react'
import { useMatchReportContext } from '../context/useMatchReportContext'
import type { MatchReportState } from '../types/matchReportState.types'

/** Estado reducer actual para callbacks async sin re-crear dependencias en cada dispatch. */
export function useMatchReportStateRef() {
  const { state } = useMatchReportContext()
  const ref = useRef<MatchReportState>(state)
  ref.current = state
  return ref
}
