import { useMemo } from 'react'
import type { MatchContext } from '../contracts'
import {
  matchContextFromSearchParams,
  matchContextLoadKey,
  matchReportSearchKey,
} from '../utils/matchReportQuery'

/** Query → contexto estable (evita nuevo objeto cada render por identidad de URLSearchParams). */
export function useStableMatchContextFromSearch(searchParams: URLSearchParams): MatchContext | null {
  const searchKey = matchReportSearchKey(searchParams)
  return useMemo(() => matchContextFromSearchParams(searchParams), [searchKey, searchParams])
}

export { matchContextLoadKey }
