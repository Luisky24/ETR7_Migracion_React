import { useContext } from 'react'
import { MatchReportContext } from './MatchReportContext'

export function useMatchReportContext() {
  const ctx = useContext(MatchReportContext)
  if (!ctx) {
    throw new Error('useMatchReportContext debe usarse dentro de MatchReportProvider')
  }
  return ctx
}
