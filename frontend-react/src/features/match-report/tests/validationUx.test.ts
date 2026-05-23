import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MatchHelpPanel } from '../components/MatchHelpPanel'
import { MatchCloseBlockedModal } from '../components/MatchCloseBlockedModal'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  selectCanAttemptFinalize,
  selectCloseBlockingErrors,
  selectHelpHasActiveNotices,
  selectMatchHelpContent,
  selectShowOperationBanner,
} from '../selectors/matchReportValidationUxSelectors'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import { recalculateMatchReport } from '../domain/scoring'
import { emptyMatchReport, playerLine } from './fixtures'

function loadedState() {
  const report = emptyMatchReport()
  return matchReportReducer(matchReportInitialState, {
    type: 'LOAD_REPORT_SUCCESS',
    payload: { response: { report, cerrada: false, fromActaSnapshot: false } },
  })
}

describe('validation UX (QA-A5)', () => {
  it('selectMatchHelpContent incluye reglas rugby y avisos borrador', () => {
    const content = selectMatchHelpContent(loadedState())
    expect(content.sections.some((s) => s.id === 'rugby-rules')).toBe(true)
    expect(content.sections.some((s) => s.id === 'draft-hint')).toBe(true)
  })

  it('selectHelpHasActiveNotices en acta vacía sin guardar', () => {
    expect(selectHelpHasActiveNotices(loadedState())).toBe(true)
  })

  it('selectShowOperationBanner oculto en estado loaded sin error', () => {
    expect(selectShowOperationBanner(loadedState())).toBe(false)
  })

  it('selectCanAttemptFinalize habilita cierre en 0-0 sin acciones', () => {
    expect(selectCanAttemptFinalize(loadedState())).toBe(true)
    expect(selectCloseBlockingErrors(loadedState())).toHaveLength(0)
  })

  it('selectCloseBlockingErrors con ΣT > ΣE', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 0, T: 1 }, { titular: true })],
      },
    })
    const state = matchReportReducer(loadedState(), {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: { report, cerrada: false, fromActaSnapshot: false } },
    })
    expect(selectCloseBlockingErrors(state).some((e) => e.code === 'CONVERSIONS_EXCEED_TRIES')).toBe(
      true,
    )
  })

  it('MatchHelpPanel cerrado no renderiza diálogo', () => {
    const html = renderToStaticMarkup(
      MatchHelpPanel({
        open: false,
        content: selectMatchHelpContent(loadedState()),
        onClose: () => {},
      }),
    )
    expect(html).toBe('')
  })

  it('MatchHelpPanel abierto muestra ayuda', () => {
    const html = renderToStaticMarkup(
      MatchHelpPanel({
        open: true,
        content: selectMatchHelpContent(loadedState()),
        onClose: () => {},
      }),
    )
    expect(html).toContain('Ayuda — acta del encuentro')
    expect(html).toContain('Reglas rugby')
  })

  it('MatchCloseBlockedModal muestra errores de cierre', () => {
    const html = renderToStaticMarkup(
      MatchCloseBlockedModal({
        open: true,
        issues: [{ code: 'CONVERSIONS_EXCEED_TRIES', message: 'Equipo inválido' }],
        onDismiss: () => {},
      }),
    )
    expect(html).toContain('No se puede cerrar el acta')
    expect(html).toContain('Equipo inválido')
  })

  it('MatchReportView no monta panel persistente de validaciones', () => {
    const src = readFileSync(
      join(import.meta.dirname, '../components/MatchReportView.tsx'),
      'utf8',
    )
    expect(src).not.toContain('MatchValidationPanel')
    expect(src).toContain('MatchHelpPanel')
  })
})
