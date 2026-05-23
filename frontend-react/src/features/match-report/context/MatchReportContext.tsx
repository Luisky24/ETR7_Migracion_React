import { createContext, useReducer, type Dispatch } from 'react'
import { matchReportReducer } from '../reducers/matchReportReducer'
import type { MatchReportAction } from '../reducers/matchReportActions'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import type { MatchReportState } from '../types/matchReportState.types'

export interface MatchReportContextValue {
  readonly state: MatchReportState
  readonly dispatch: Dispatch<MatchReportAction>
}

export const MatchReportContext = createContext<MatchReportContextValue | null>(null)

export function useMatchReportReducer() {
  return useReducer(matchReportReducer, matchReportInitialState)
}
