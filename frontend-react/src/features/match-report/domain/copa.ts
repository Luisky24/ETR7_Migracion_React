import type { MatchPhaseLabel, MatchScore, MatchValidationResult } from '../contracts'
import { validationFailure, validationOk, validationWarning } from './validation'

export interface CopaCloseContext {
  readonly phase: MatchPhaseLabel
  readonly isCopaGroup: boolean
  readonly identificacionEncuentro: string
  readonly score: MatchScore
  readonly placeholdersResolved: {
    readonly ganadorFound: boolean
    readonly perdedorFound: boolean
  }
}

export function isCopaCloseApplicable(ctx: CopaCloseContext): boolean {
  if (ctx.phase !== 'Fase II' || !ctx.isCopaGroup) return false
  return !isRankingFinalExcluded(ctx.identificacionEncuentro)
}

/**
 * Exclusiones de sustitución COPA (paridad legacy: Final, 3/4, 5/6, 7/8).
 * Semifinal no se excluye aunque contenga la subcadena "Final".
 */
export function isRankingFinalExcluded(identificacionEncuentro: string): boolean {
  const trimmed = identificacionEncuentro.trim()
  if (!trimmed) return false
  if (/Semifinal/i.test(trimmed)) return false
  if (/\bFinal\b/i.test(trimmed)) return true
  if (/\b3\s*\/\s*4\b/.test(trimmed)) return true
  if (/\b5\s*\/\s*6\b/.test(trimmed)) return true
  if (/\b7\s*\/\s*8\b/.test(trimmed)) return true
  return false
}

export function extractIdentifFase(identificacionEncuentro: string): string {
  const first = identificacionEncuentro.trim().split(/\s+/)[0]
  return first ?? ''
}

export function buildCopaPlaceholderLabels(identifFase: string): {
  readonly ganador: string
  readonly perdedor: string
} {
  return {
    ganador: `Ganador ${identifFase}`,
    perdedor: `Perdedor ${identifFase}`,
  }
}

export function validateCopaClose(ctx: CopaCloseContext): MatchValidationResult {
  if (!isCopaCloseApplicable(ctx)) {
    return validationOk()
  }

  if (ctx.score.local === ctx.score.visitante) {
    return validationFailure('COPA_DRAW_NOT_ALLOWED', 'No se puede cerrar un encuentro COPA en empate.')
  }

  const { ganadorFound, perdedorFound } = ctx.placeholdersResolved
  if (!ganadorFound || !perdedorFound) {
    return validationFailure(
      'COPA_PLACEHOLDER_NOT_FOUND',
      'No se encontraron placeholders Ganador/Perdedor en el calendario para este cruce.',
    )
  }

  return validationOk()
}

export function validateCopaConsistencyFase2(
  phase: MatchPhaseLabel,
  referenciaEncuentro: string,
): MatchValidationResult {
  if (phase !== 'Fase II') return validationOk()
  if (referenciaEncuentro.trim().length > 0) return validationOk()
  return validationFailure(
    'MISSING_REFERENCIA_F2',
    'Fase II requiere referencia_encuentro para operaciones de acta.',
  )
}

export function warnCopaEmpateOnDraft(
  ctx: CopaCloseContext,
): MatchValidationResult {
  if (!isCopaCloseApplicable(ctx)) return validationOk()
  if (ctx.score.local === ctx.score.visitante) {
    return validationWarning(
      'COPA_DRAW_DRAFT',
      'Empate en marcador: el cierre COPA será rechazado hasta que haya ganador.',
    )
  }
  return validationOk()
}
