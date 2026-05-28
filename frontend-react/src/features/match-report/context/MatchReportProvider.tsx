import { useMemo, type ReactNode } from 'react'
import { MatchReportContext, useMatchReportReducer } from './MatchReportContext'
import { installRuntimeDocDiagnostics } from '../tools/runtimeDocDiagnostics'

export interface MatchReportProviderProps {
  readonly children: ReactNode
}

export function MatchReportProvider({ children }: MatchReportProviderProps) {
  const [state, dispatch] = useMatchReportReducer()
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])
  // A4.1.1: registra diagnostics runtime (DEV / staging-gas) con lectura del state actual.
  installRuntimeDocDiagnostics(() => state)
  return <MatchReportContext.Provider value={value}>{children}</MatchReportContext.Provider>
}
