import type { ActaMatchKey } from '../contracts/actaDocument'
import type { MatchContext } from '../contracts'

export function matchKeyFromContext(context: MatchContext): ActaMatchKey {
  return {
    category: context.category,
    phase: context.phase,
    matchId: context.encuentroId,
  }
}
