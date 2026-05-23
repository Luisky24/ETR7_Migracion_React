import type { MatchScore } from '../contracts'

export type MatchResult = 'local_win' | 'visitante_win' | 'draw'

export function resolveMatchResult(score: MatchScore): MatchResult {
  if (score.local > score.visitante) return 'local_win'
  if (score.visitante > score.local) return 'visitante_win'
  return 'draw'
}
