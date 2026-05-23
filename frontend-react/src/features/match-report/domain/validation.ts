import type {
  MatchContext,
  MatchReport,
  MatchScore,
  MatchValidationIssue,
  MatchValidationResult,
} from '../contracts'
import { resolveMatchResult } from './matchResult'
import type { MatchTeam, TeamSide } from '../contracts'
import { buildActionSummary, computeMatchScoreFromTotals, sumPlayerActions } from './scoring'
import type { CopaCloseContext } from './copa'
import { validateCopaClose, validateCopaConsistencyFase2, warnCopaEmpateOnDraft } from './copa'

export function validationOk(
  warnings: readonly MatchValidationIssue[] = [],
): MatchValidationResult {
  return { ok: true, errors: [], warnings }
}

export function validationFailure(
  code: string,
  message: string,
  field?: string,
): MatchValidationResult {
  return {
    ok: false,
    errors: [{ code, message, field }],
    warnings: [],
  }
}

export function validationWarning(code: string, message: string, field?: string): MatchValidationResult {
  return {
    ok: true,
    errors: [],
    warnings: [{ code, message, field }],
  }
}

export function mergeValidationResults(
  ...results: readonly MatchValidationResult[]
): MatchValidationResult {
  const errors = results.flatMap((r) => r.errors)
  const warnings = results.flatMap((r) => r.warnings)
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  }
}

export function teamActionTotals(team: MatchTeam) {
  return sumPlayerActions(team.players)
}

/** ΣT del equipo en cancha no puede superar ΣE del equipo (regla rugby agregada). */
export function teamConversionsExceedTries(team: MatchTeam): boolean {
  const totals = teamActionTotals(team)
  return totals.T > totals.E
}

export function teamConversionsExceedTriesMessage(team: MatchTeam): string | null {
  if (!teamConversionsExceedTries(team)) {
    return null
  }
  const totals = teamActionTotals(team)
  return `${team.equipo}: las transformaciones del equipo (${totals.T}) no pueden superar los ensayos (${totals.E}).`
}

function teamConversionFieldId(side: TeamSide): string {
  return `team:${side}:conversions`
}

/** ΣT ≤ ΣE por equipo (jugadores en cancha), no por fila individual. */
export function validateConversionsVsTries(report: MatchReport): MatchValidationResult {
  const issues: MatchValidationIssue[] = []

  const sides: readonly TeamSide[] = ['local', 'visitante']
  for (const side of sides) {
    const team = side === 'local' ? report.local : report.visitante
    const message = teamConversionsExceedTriesMessage(team)
    if (message) {
      issues.push({
        code: 'CONVERSIONS_EXCEED_TRIES',
        message,
        field: teamConversionFieldId(side),
      })
    }
  }

  if (issues.length > 0) {
    return { ok: false, errors: issues, warnings: [] }
  }
  return validationOk()
}

/** Validaciones de edición (acciones numéricas, dorsales). */
export function validateEditActions(report: MatchReport): MatchValidationResult {
  const issues: MatchValidationIssue[] = []

  for (const team of [report.local, report.visitante]) {
    for (const p of team.players) {
      if (!p.isTitularOrSuplente) continue
      const { E, T, PC, Tar } = p.actions
      if ([E, T, PC, Tar].some((n) => n < 0 || !Number.isFinite(n))) {
        issues.push({
          code: 'INVALID_ACTION_VALUE',
          message: `Valores de anotación inválidos para ${p.jugador}.`,
          field: p.playerId,
        })
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, errors: issues, warnings: [] }
  }

  return validateConversionsVsTries(report)
}

/** Coherencia marcador derivado vs marcador almacenado. */
export function validateScoreCoherence(report: MatchReport): MatchValidationResult {
  const summary = buildActionSummary(report.local.players, report.visitante.players)
  if (!summary.hasAnyAction) return validationOk()

  const derived = computeMatchScoreFromTotals(summary.localTotals, summary.visitanteTotals)
  const stored = report.score

  if (derived.local !== stored.local || derived.visitante !== stored.visitante) {
    return validationWarning(
      'SCORE_ACTION_MISMATCH',
      'El marcador no coincide con la suma de anotaciones por jugador.',
    )
  }
  return validationOk()
}

export function validateF2Referencia(context: MatchContext): MatchValidationResult {
  return validateCopaConsistencyFase2(context.phase, context.referenciaEncuentro)
}

/** Validación de guardado borrador: requiere al menos una acción. */
export function validateDraftSave(report: MatchReport): MatchValidationResult {
  const summary = buildActionSummary(report.local.players, report.visitante.players)
  if (!summary.hasAnyAction) {
    return validationFailure(
      'DRAFT_NO_ACTIONS',
      'No se puede guardar el acta sin acciones asignadas a los jugadores.',
    )
  }
  return mergeValidationResults(validateEditActions(report), validateF2Referencia(report.context))
}

export const CLOSE_EMPTY_MATCH_WARNING_CODE = 'CLOSE_EMPTY_MATCH' as const
export const CLOSE_EMPTY_REQUIRES_CONFIRM_CODE = 'CLOSE_EMPTY_REQUIRES_CONFIRM' as const

export interface CloseValidationInput {
  readonly report: MatchReport
  readonly copaContext?: CopaCloseContext
  readonly allowScoreOnlyClose: boolean
  /** Confirmación explícita de cierre sin acciones (solo finalize). */
  readonly confirmEmptyClose?: boolean
}

function validateEmptyScoreOnlyClose(
  report: MatchReport,
  copaContext: CopaCloseContext | undefined,
  allowScoreOnlyClose: boolean,
): MatchValidationResult {
  const summary = buildActionSummary(report.local.players, report.visitante.players)
  if (summary.hasAnyAction || !allowScoreOnlyClose) {
    return validationOk()
  }

  const score = report.score
  if (score.local < 0 || score.visitante < 0) {
    return validationFailure('INVALID_SCORE', 'Marcador inválido para cierre sin acciones.')
  }
  if (resolveMatchResult(score) === 'draw' && copaContext?.isCopaGroup) {
    return validationFailure('COPA_DRAW_NOT_ALLOWED', 'No se puede cerrar un encuentario COPA en empate.')
  }

  return validationWarning(
    CLOSE_EMPTY_MATCH_WARNING_CODE,
    'El acta no contiene acciones registradas. Deberá confirmar el cierre antes de finalizar.',
  )
}

/** Validaciones de cierre (panel UI): errores bloquean; avisos sin acciones no bloquean. */
export function validateClose(input: CloseValidationInput): MatchValidationResult {
  const { report, copaContext, allowScoreOnlyClose } = input
  const summary = buildActionSummary(report.local.players, report.visitante.players)

  if (!summary.hasAnyAction && !allowScoreOnlyClose) {
    return validationFailure(
      'CLOSE_NO_ACTIONS',
      'No se puede finalizar sin anotaciones ni política de cierre por marcador.',
    )
  }

  const base = mergeValidationResults(
    validateEditActions(report),
    validateF2Referencia(report.context),
    validateScoreCoherence(report),
    validateEmptyScoreOnlyClose(report, copaContext, allowScoreOnlyClose),
  )

  if (copaContext) {
    return mergeValidationResults(base, validateCopaClose(copaContext), warnCopaEmpateOnDraft(copaContext))
  }

  return base
}

/** Validación de finalize: exige confirmEmptyClose cuando no hay acciones. */
export function validateFinalizeClose(input: CloseValidationInput): MatchValidationResult {
  const display = validateClose(input)
  if (!display.ok) return display

  const summary = buildActionSummary(input.report.local.players, input.report.visitante.players)
  if (
    !summary.hasAnyAction &&
    input.allowScoreOnlyClose &&
    !input.confirmEmptyClose
  ) {
    return validationFailure(
      CLOSE_EMPTY_REQUIRES_CONFIRM_CODE,
      'Confirme el cierre del acta sin acciones registradas.',
    )
  }

  return display
}

export function validateManualScoreUpdate(
  report: MatchReport,
  nextScore: MatchScore,
  allowManualScoreOverride: boolean,
): MatchValidationResult {
  if (!allowManualScoreOverride) {
    return validationFailure(
      'SCORE_OVERRIDE_DISABLED',
      'El marcador se deriva de las anotaciones; override manual no permitido.',
    )
  }

  const summary = buildActionSummary(report.local.players, report.visitante.players)
  if (summary.hasAnyAction) {
    return validationFailure(
      'SCORE_OVERRIDE_WITH_ACTIONS',
      'No se puede editar el marcador manualmente mientras hay anotaciones por jugador.',
    )
  }

  if (nextScore.local < 0 || nextScore.visitante < 0) {
    return validationFailure('INVALID_SCORE', 'El marcador no puede ser negativo.')
  }

  return validationOk()
}
