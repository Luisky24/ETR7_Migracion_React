import type { MatchResult } from '../domain/matchResult'

export function formatMatchResultLabel(result: MatchResult): string {
  switch (result) {
    case 'local_win':
      return 'Victoria local'
    case 'visitante_win':
      return 'Victoria visitante'
    case 'draw':
      return 'Empate'
  }
}
