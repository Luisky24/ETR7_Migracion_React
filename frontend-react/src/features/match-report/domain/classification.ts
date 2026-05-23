import type { MatchClassification, MatchScore } from '../contracts'
import {
  CLASSIFICATION_DRAW,
  CLASSIFICATION_LOSS,
  CLASSIFICATION_WIN,
  DEFENSIVE_BONUS_DIFF_MIN,
  DEFENSIVE_BONUS_DIFF_EXCLUSIVE_LIMIT,
} from './constants'
import { resolveMatchResult } from './matchResult'

/** Regla oficial: perdedor con margen < 8 (y >= 1) recibe BD=1. Alineado con GAS `dif < 8`. */
export function qualifiesForDefensiveBonus(absScoreDifference: number): boolean {
  return (
    absScoreDifference >= DEFENSIVE_BONUS_DIFF_MIN &&
    absScoreDifference < DEFENSIVE_BONUS_DIFF_EXCLUSIVE_LIMIT
  )
}

export const ZERO_CLASSIFICATION: MatchClassification = {
  P: 0,
  BO: 0,
  BD: 0,
  Total: 0,
}

export function computeClassificationTotal(c: MatchClassification): number {
  return c.P + c.BO + c.BD
}

function withTotal(c: Omit<MatchClassification, 'Total'>): MatchClassification {
  return {
    ...c,
    Total: c.P + c.BO + c.BD,
  }
}

/** Clasificación preview en cliente (BO=0 salvo merge posterior GAS). */
export function computeClientClassificationPreview(
  score: MatchScore,
  options: { readonly hasAnyAction: boolean },
): { readonly local: MatchClassification; readonly visitante: MatchClassification } {
  if (!options.hasAnyAction) {
    return { local: { ...ZERO_CLASSIFICATION }, visitante: { ...ZERO_CLASSIFICATION } }
  }

  const diff = Math.abs(score.local - score.visitante)
  const defensiveBonus = qualifiesForDefensiveBonus(diff) ? 1 : 0
  const result = resolveMatchResult(score)

  switch (result) {
    case 'local_win':
      return {
        local: withTotal({ P: CLASSIFICATION_WIN, BO: 0, BD: 0 }),
        visitante: withTotal({ P: CLASSIFICATION_LOSS, BO: 0, BD: defensiveBonus }),
      }
    case 'visitante_win':
      return {
        local: withTotal({ P: CLASSIFICATION_LOSS, BO: 0, BD: defensiveBonus }),
        visitante: withTotal({ P: CLASSIFICATION_WIN, BO: 0, BD: 0 }),
      }
    case 'draw':
      return {
        local: withTotal({ P: CLASSIFICATION_DRAW, BO: 0, BD: 0 }),
        visitante: withTotal({ P: CLASSIFICATION_DRAW, BO: 0, BD: 0 }),
      }
  }
}

export interface GasOfficialClassificationInput {
  readonly preview: {
    readonly local: MatchClassification
    readonly visitante: MatchClassification
  }
  readonly score: MatchScore
  readonly phase: 'Fase I' | 'Fase II'
  readonly isCopaGroup: boolean
  /** puntosExtra / numEncuentro desde GAS (solo F2 COPA). */
  readonly f2BonusPoints?: number
}

/**
 * Clasificación oficial post-GAS (F2 COPA: BO al ganador; perdedor BD=0, Total=0).
 * En Fase I o sin COPA devuelve el preview sin cambios.
 */
export function applyGasOfficialClassification(
  input: GasOfficialClassificationInput,
): { readonly local: MatchClassification; readonly visitante: MatchClassification } {
  const { preview, score, phase, isCopaGroup, f2BonusPoints } = input

  if (phase !== 'Fase II' || !isCopaGroup || f2BonusPoints == null || f2BonusPoints <= 0) {
    return {
      local: { ...preview.local },
      visitante: { ...preview.visitante },
    }
  }

  const result = resolveMatchResult(score)
  if (result === 'draw') {
    return {
      local: { ...preview.local },
      visitante: { ...preview.visitante },
    }
  }

  if (result === 'local_win') {
    const local: MatchClassification = {
      P: preview.local.P,
      BO: f2BonusPoints,
      BD: preview.local.BD,
      Total: preview.local.P + f2BonusPoints + preview.local.BD,
    }
    const visitante: MatchClassification = {
      P: preview.visitante.P,
      BO: 0,
      BD: 0,
      Total: 0,
    }
    return { local, visitante }
  }

  const visitante: MatchClassification = {
    P: preview.visitante.P,
    BO: f2BonusPoints,
    BD: preview.visitante.BD,
    Total: preview.visitante.P + f2BonusPoints + preview.visitante.BD,
  }
  const local: MatchClassification = {
    P: preview.local.P,
    BO: 0,
    BD: 0,
    Total: 0,
  }
  return { local, visitante }
}
