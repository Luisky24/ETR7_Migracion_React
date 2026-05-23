import type { MatchValidationIssue, MatchValidationResult } from '../contracts'
import {
  buildCloseValidationInput,
  DEFAULT_CLOSE_POLICY,
  validateClose,
  validateDraftSave,
} from '../domain'
import type { CopaCloseContext } from '../domain/copa'
import type { MatchReportState } from '../types/matchReportState.types'
import { selectIsDirty, selectIsEditable, selectMatchReport } from './matchReportSelectors'
import { isOperationBusy } from '../domain/operationState'
import { selectValidationDisplay } from './matchReportUiSelectors'

export type HelpItemKind = 'info' | 'warning' | 'tip'

export interface MatchHelpItem {
  readonly kind: HelpItemKind
  readonly code?: string
  readonly message: string
}

export interface MatchHelpSection {
  readonly id: string
  readonly title: string
  readonly items: readonly MatchHelpItem[]
}

export interface MatchHelpContent {
  readonly sections: readonly MatchHelpSection[]
  readonly hasContent: boolean
}

const RUGBY_RULES_SECTION: MatchHelpSection = {
  id: 'rugby-rules',
  title: 'Reglas rugby (resumen)',
  items: [
    {
      kind: 'tip',
      message:
        'Las transformaciones (T) se validan por equipo: la suma de T no puede superar la suma de ensayos (E) en cancha.',
    },
    {
      kind: 'tip',
      message: 'Un partido 0-0 sin anotaciones en jugadores puede cerrarse confirmando explícitamente el cierre.',
    },
    {
      kind: 'tip',
      message: 'El marcador deportivo se deriva de E, T y penales (PC) salvo cierre por marcador sin acciones.',
    },
    {
      kind: 'tip',
      message: 'En COPA (Fase II), el cierre no admite empate en el marcador.',
    },
  ],
}

const UX_GUIDE_SECTION: MatchHelpSection = {
  id: 'ux-guide',
  title: 'Uso del acta',
  items: [
    {
      kind: 'info',
      message: 'Los errores de campo se muestran en la celda correspondiente al editar.',
    },
    {
      kind: 'info',
      message: 'Al cerrar el acta, se le avisará si hay incidencias bloqueantes o si debe confirmar un cierre sin acciones.',
    },
    {
      kind: 'info',
      message: 'Los avisos no bloqueantes y esta ayuda están disponibles desde el botón Ayuda.',
    },
  ],
}

function issuesToHelpItems(
  issues: readonly MatchValidationIssue[],
  kind: HelpItemKind,
): readonly MatchHelpItem[] {
  return issues.map((issue) => ({
    kind,
    code: issue.code,
    message: issue.message,
  }))
}

function sectionFromResult(
  id: string,
  title: string,
  result: MatchValidationResult | null,
  warningKind: HelpItemKind = 'warning',
): MatchHelpSection | null {
  if (!result) return null
  const items = [
    ...issuesToHelpItems(result.warnings, warningKind),
    ...issuesToHelpItems(
      result.errors,
      'warning',
    ),
  ]
  if (items.length === 0) return null
  return { id, title, items }
}

/** Contenido del panel Ayuda: reglas, avisos informativos y warnings no bloqueantes. */
export function selectMatchHelpContent(
  state: MatchReportState,
  copaContext?: CopaCloseContext,
): MatchHelpContent {
  const bundle = selectValidationDisplay(state, copaContext)
  const sections: MatchHelpSection[] = [RUGBY_RULES_SECTION, UX_GUIDE_SECTION]

  const draftInfo = bundle.draft
  if (draftInfo && !draftInfo.ok) {
    sections.push({
      id: 'draft-hint',
      title: 'Guardar borrador',
      items: issuesToHelpItems(draftInfo.errors, 'info'),
    })
  }

  const closeSection = sectionFromResult('close-warnings', 'Cierre del acta', bundle.close)
  if (closeSection) sections.push(closeSection)

  const scoreSection = sectionFromResult(
    'score-coherence',
    'Marcador y acciones',
    bundle.scoreCoherence,
  )
  if (scoreSection) sections.push(scoreSection)

  const last = bundle.lastInteraction
  if (last && (last.warnings.length > 0 || (!last.ok && last.errors.length > 0))) {
    const lastSection = sectionFromResult('last-interaction', 'Última operación', last, 'info')
    if (lastSection) sections.push(lastSection)
  }

  const dynamicCount = sections.length - 2
  return {
    sections,
    hasContent: dynamicCount > 0 || true,
  }
}

export function selectCloseBlockingErrors(
  state: MatchReportState,
  copaContext?: CopaCloseContext,
): readonly MatchValidationIssue[] {
  const report = selectMatchReport(state)
  if (!report) return []
  const close = validateClose(buildCloseValidationInput(report, copaContext, DEFAULT_CLOSE_POLICY))
  return close.errors
}

export function selectDraftBlockingErrors(state: MatchReportState): readonly MatchValidationIssue[] {
  const report = selectMatchReport(state)
  if (!report) return []
  const draft = validateDraftSave(report)
  return draft.errors
}

export function selectCanAttemptSave(state: MatchReportState): boolean {
  if (!selectIsEditable(state) || !selectIsDirty(state) || isOperationBusy(state.operation)) {
    return false
  }
  return !!state.report
}

export function selectCanAttemptFinalize(state: MatchReportState): boolean {
  if (!selectIsEditable(state) || isOperationBusy(state.operation)) return false
  return !!state.report
}

export function selectShowOperationBanner(state: MatchReportState): boolean {
  if (isOperationBusy(state.operation)) return true
  if (state.operationError) return true
  if (state.recovery?.canRetrySave || state.recovery?.canRetryFinalize || state.recovery?.canReload) {
    return true
  }
  const op = state.operation
  return op === 'error' || op === 'saving' || op === 'finalizing'
}

/** Indicador en botón Ayuda cuando hay avisos dinámicos activos. */
export function selectHelpHasActiveNotices(
  state: MatchReportState,
  copaContext?: CopaCloseContext,
): boolean {
  const bundle = selectValidationDisplay(state, copaContext)
  return (
    (bundle.close?.warnings.length ?? 0) > 0 ||
    (bundle.scoreCoherence?.warnings.length ?? 0) > 0 ||
    (bundle.draft && !bundle.draft.ok) ||
    !!(bundle.lastInteraction && bundle.lastInteraction.warnings.length > 0)
  )
}
