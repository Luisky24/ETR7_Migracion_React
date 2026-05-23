import type { MatchValidationResult, TeamSide } from '../contracts'
import {
  buildCloseValidationInput,
  buildActionSummary,
  DEFAULT_CLOSE_POLICY,
  validateClose,
  validateDraftSave,
  validateScoreCoherence,
} from '../domain'
import type { CopaCloseContext } from '../domain/copa'
import {
  INCIDENCIAS_FIELD_KEY,
  playerActionFieldKey,
  REFEREE_FIELD_KEY,
  teamObservationsFieldKey,
} from '../types/matchReportForm.types'
import { refereeDisplayName } from '../utils/referee'
import type { MatchReportState } from '../types/matchReportState.types'
import type { MatchReportOperationStatus } from '../types/matchReportOperation.types'
import {
  selectCanFinalize,
  selectCanSaveDraft,
  selectClosureState,
  selectIsEditable,
  selectIsReadOnly,
  selectLastClosure,
  selectLastValidation,
  selectMatchReport,
} from './matchReportSelectors'
import {
  selectOperation,
  selectOperationError,
  selectOperationLabel,
  selectRecoveryHints,
} from './matchReportOperationSelectors'

export function selectCanEdit(state: MatchReportState): boolean {
  return selectIsEditable(state)
}

export function selectCanFinalizeUi(state: MatchReportState, copaContext?: CopaCloseContext): boolean {
  return selectCanFinalize(state, copaContext)
}

export function selectHasRecoverableError(state: MatchReportState): boolean {
  const err = selectOperationError(state)
  if (!err) return false
  return err.recoverable && !err.shouldBlock
}

export type OperationBannerVariant = 'neutral' | 'busy' | 'success' | 'error' | 'warning'

export function selectOperationBannerVariant(state: MatchReportState): OperationBannerVariant {
  const op = selectOperation(state)
  if (op === 'error' || state.operationError) return 'error'
  if (op === 'finalized' || op === 'locked') return 'success'
  if (op === 'loading' || op === 'saving' || op === 'finalizing') return 'busy'
  if (op === 'saved') return 'success'
  return 'neutral'
}

/** Claves `side:playerId:field` con cambios respecto al snapshot guardado. */
export function selectDirtyFieldKeys(state: MatchReportState): ReadonlySet<string> {
  const report = state.report
  const snapshot = state.savedSnapshot
  const keys = new Set<string>()
  if (!report || !snapshot) return keys

  const sides: readonly TeamSide[] = ['local', 'visitante']
  for (const side of sides) {
    const cur = side === 'local' ? report.local : report.visitante
    const sav = side === 'local' ? snapshot.local : snapshot.visitante
    for (const p of cur.players) {
      const saved = sav.players.find((x) => x.playerId === p.playerId)
      if (!saved) {
        keys.add(`${side}:${p.playerId}`)
        continue
      }
      for (const field of ['E', 'T', 'PC', 'Tar'] as const) {
        if (p.actions[field] !== saved.actions[field]) {
          keys.add(playerActionFieldKey(side, p.playerId, field))
        }
      }
    }
  }

  if (refereeDisplayName(report.referee) !== refereeDisplayName(snapshot.referee)) {
    keys.add(REFEREE_FIELD_KEY)
  }
  if (report.incidencias !== snapshot.incidencias) {
    keys.add(INCIDENCIAS_FIELD_KEY)
  }
  for (const side of sides) {
    const cur = side === 'local' ? report.local : report.visitante
    const sav = side === 'local' ? snapshot.local : snapshot.visitante
    if (cur.observaciones !== sav.observaciones) {
      keys.add(teamObservationsFieldKey(side))
    }
  }

  return keys
}

export function selectDirtyFieldCount(state: MatchReportState): number {
  return selectDirtyFieldKeys(state).size
}

export interface ValidationDisplayBundle {
  readonly draft: MatchValidationResult | null
  readonly close: MatchValidationResult | null
  readonly scoreCoherence: MatchValidationResult | null
  readonly lastInteraction: MatchValidationResult | null
  readonly hasIssues: boolean
}

export function selectValidationDisplay(
  state: MatchReportState,
  copaContext?: CopaCloseContext,
): ValidationDisplayBundle {
  const report = state.report
  const lastInteraction = selectLastValidation(state)

  if (!report) {
    return {
      draft: null,
      close: null,
      scoreCoherence: null,
      lastInteraction,
      hasIssues: !!(lastInteraction && (!lastInteraction.ok || lastInteraction.warnings.length > 0)),
    }
  }

  const draft = validateDraftSave(report)
  const close = validateClose(buildCloseValidationInput(report, copaContext, DEFAULT_CLOSE_POLICY))
  const scoreCoherence = validateScoreCoherence(report)

  const hasIssues =
    !draft.ok ||
    !close.ok ||
    !scoreCoherence.ok ||
    draft.warnings.length > 0 ||
    close.warnings.length > 0 ||
    scoreCoherence.warnings.length > 0 ||
    !!(lastInteraction && (!lastInteraction.ok || lastInteraction.warnings.length > 0))

  return { draft, close, scoreCoherence, lastInteraction, hasIssues }
}

export interface ClassificationRowView {
  readonly side: TeamSide
  readonly equipo: string
  readonly P: number
  readonly BO: number
  readonly BD: number
  readonly Total: number
}

export function selectClassificationRows(state: MatchReportState): readonly ClassificationRowView[] {
  const report = selectMatchReport(state)
  if (!report) return []
  return (['local', 'visitante'] as const).map((side) => {
    const team = side === 'local' ? report.local : report.visitante
    const c = team.classification
    return {
      side,
      equipo: team.equipo,
      P: c.P,
      BO: c.BO,
      BD: c.BD,
      Total: c.Total,
    }
  })
}

export function selectActionSummaryView(state: MatchReportState) {
  const report = selectMatchReport(state)
  if (!report) return null
  return buildActionSummary(report.local.players, report.visitante.players)
}

export interface MatchReportHeaderView {
  readonly title: string
  readonly subtitle: string
  readonly operation: MatchReportOperationStatus
  readonly operationLabel: string
  readonly closureState: ReturnType<typeof selectClosureState>
  readonly isReadOnly: boolean
  readonly fromActaSnapshot: boolean
}

export function selectMatchReportHeaderView(state: MatchReportState): MatchReportHeaderView | null {
  const report = selectMatchReport(state)
  if (!report) return null
  const { context } = report
  return {
    title: `${context.equipoLocal} — ${context.equipoVisitante}`,
    subtitle: `Grupo ${context.grupo} · ${context.phase} · ${context.hora || '—'} · ${context.campo || '—'}`,
    operation: selectOperation(state),
    operationLabel: selectOperationLabel(state),
    closureState: selectClosureState(state),
    isReadOnly: selectIsReadOnly(state),
    fromActaSnapshot: report.fromActaSnapshot,
  }
}

export function selectClosurePanelView(state: MatchReportState) {
  return {
    canSave: selectCanSaveDraft(state),
    canFinalize: selectCanFinalizeUi(state),
    lastClosure: selectLastClosure(state),
    recovery: selectRecoveryHints(state),
    operation: selectOperation(state),
  }
}
