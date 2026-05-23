import type {
  ActaEditability,
  MatchClosureResult,
  MatchContext,
  MatchReport,
  MatchStatus,
  MatchValidationResult,
} from '../contracts'
import { applyGasOfficialClassification } from './classification'
import { recalculateMatchReport } from './scoring'
import type { CloseValidationInput } from './validation'
import { buildActionSummary } from './scoring'
import { validateFinalizeClose } from './validation'

export interface ClosePolicy {
  readonly requireActionsForDraft: true
  readonly allowScoreOnlyClose: true
  readonly allowManualScoreOverride: boolean
}

export const DEFAULT_CLOSE_POLICY: ClosePolicy = {
  requireActionsForDraft: true,
  allowScoreOnlyClose: true,
  allowManualScoreOverride: false,
}

export interface FinalizeMatchReportInput {
  readonly report: MatchReport
  readonly closeValidation: CloseValidationInput
  readonly policy?: ClosePolicy
  readonly gasOfficial?: {
    readonly isCopaGroup: boolean
    readonly f2BonusPoints?: number
  }
}

export interface FinalizeMatchReportResult {
  readonly validation: MatchValidationResult
  readonly closure: MatchClosureResult
  readonly report: MatchReport
}

/** Centraliza validación y resultado de cierre (sin I/O). */
/** Acta sin acciones en cancha: requiere confirmación UX antes de finalize. */
export function needsEmptyCloseConfirmation(
  report: MatchReport,
  policy: ClosePolicy = DEFAULT_CLOSE_POLICY,
): boolean {
  if (!policy.allowScoreOnlyClose) return false
  const summary = buildActionSummary(report.local.players, report.visitante.players)
  return !summary.hasAnyAction
}

export function finalizeMatchReport(input: FinalizeMatchReportInput): FinalizeMatchReportResult {
  const validation = validateFinalizeClose(input.closeValidation)

  if (!validation.ok) {
    const firstError = validation.errors[0]
    return {
      validation,
      closure: {
        ok: false,
        cerrada: false,
        errorCode: 'VALIDATION_FAILED',
        message: firstError?.message ?? 'Validación de cierre fallida.',
      },
      report: input.report,
    }
  }

  let report = recalculateMatchReport(input.report)
  let serverClassification: FinalizeMatchReportResult['closure']['serverClassification']

  if (input.gasOfficial) {
    const preview = {
      local: report.local.classification,
      visitante: report.visitante.classification,
    }
    const official = applyGasOfficialClassification({
      preview,
      score: report.score,
      phase: report.context.phase,
      isCopaGroup: input.gasOfficial.isCopaGroup,
      f2BonusPoints: input.gasOfficial.f2BonusPoints,
    })
    serverClassification = official
    report = {
      ...report,
      local: { ...report.local, classification: official.local },
      visitante: { ...report.visitante, classification: official.visitante },
      cerrada: true,
      editability: 'read_only',
    }
  } else {
    report = lockReport(report).report
  }

  return {
    validation,
    closure: {
      ok: true,
      cerrada: true,
      serverClassification,
    },
    report,
  }
}

export function lockReport(report: MatchReport): { readonly report: MatchReport } {
  return {
    report: {
      ...report,
      cerrada: true,
      editability: 'read_only',
    },
  }
}

export function deriveEditability(
  matchStatus: MatchStatus,
  cerrada: boolean,
): ActaEditability {
  if (cerrada || matchStatus === 'acta_cerrada') return 'read_only'
  if (matchStatus === 'acta_abierta') return 'editable'
  if (matchStatus === 'sin_alineacion' || matchStatus === 'alineacion_parcial') {
    return 'blocked'
  }
  return 'blocked'
}

export function buildCloseValidationInput(
  report: MatchReport,
  copaContext?: CloseValidationInput['copaContext'],
  policy: ClosePolicy = DEFAULT_CLOSE_POLICY,
  options?: { readonly confirmEmptyClose?: boolean },
): CloseValidationInput {
  return {
    report,
    copaContext,
    allowScoreOnlyClose: policy.allowScoreOnlyClose,
    confirmEmptyClose: options?.confirmEmptyClose ?? false,
  }
}

export function isReportEditable(report: MatchReport | null): boolean {
  return report?.editability === 'editable' && !report.cerrada
}

export function canOpenMatchReport(context: MatchContext): boolean {
  return context.matchStatus === 'acta_abierta' || context.matchStatus === 'acta_cerrada'
}
