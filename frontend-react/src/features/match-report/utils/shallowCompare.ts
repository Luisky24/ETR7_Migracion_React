import type { MatchReport } from '../contracts'

export function reportsEqual(a: MatchReport | null, b: MatchReport | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return JSON.stringify(a) === JSON.stringify(b)
}
