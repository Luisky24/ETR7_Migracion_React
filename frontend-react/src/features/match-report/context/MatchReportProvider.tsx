import { useMemo, type ReactNode } from 'react'
import { MatchReportContext, useMatchReportReducer } from './MatchReportContext'

export interface MatchReportProviderProps {
  readonly children: ReactNode
}

export function MatchReportProvider({ children }: MatchReportProviderProps) {
  const [state, dispatch] = useMatchReportReducer()
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])
  return <MatchReportContext.Provider value={value}>{children}</MatchReportContext.Provider>
}
