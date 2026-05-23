import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MatchActionsTable } from '../components/MatchActionsTable'
import { MatchClosurePanel } from '../components/MatchClosurePanel'
import { MatchFinalizeConfirmModal } from '../components/MatchFinalizeConfirmModal'
import { MatchRefereeField } from '../components/MatchRefereeField'
import { MatchTeamObservationsField } from '../components/MatchTeamObservationsField'
import { MatchOperationBanner } from '../components/MatchOperationBanner'
import { MatchHelpPanel } from '../components/MatchHelpPanel'
import { MatchCloseBlockedModal } from '../components/MatchCloseBlockedModal'
import { normalizeOperationError } from '../utils/errorNormalizer'
import { emptyMatchReport } from './fixtures'

describe('match report UI components', () => {
  it('MatchActionsTable renderiza inputs por jugador', () => {
    const report = emptyMatchReport()
    const html = renderToStaticMarkup(
      createElement(MatchActionsTable, {
        side: 'local',
        team: report.local,
        canEdit: true,
        isFieldDirty: () => false,
        getFieldError: () => null,
        onActionChange: () => {},
      }),
    )
    expect(html).toContain('Jugador L1')
    expect(html).toContain('type="number"')
    expect(html.match(/type="number"/g)?.length).toBe(report.local.players.length * 4)
  })

  it('MatchActionsTable marca error de campo en rojo', () => {
    const report = emptyMatchReport()
    const playerId = report.local.players[0]!.playerId
    const html = renderToStaticMarkup(
      createElement(MatchActionsTable, {
        side: 'local',
        team: report.local,
        canEdit: true,
        isFieldDirty: () => false,
        getFieldError: (_s, id, field) =>
          id === playerId && field === 'E' ? 'Valor inválido para E.' : null,
        onActionChange: () => {},
      }),
    )
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('border-red-400')
  })

  it('MatchActionsTable resalta campo dirty en ámbar', () => {
    const report = emptyMatchReport()
    const playerId = report.local.players[0]!.playerId
    const html = renderToStaticMarkup(
      createElement(MatchActionsTable, {
        side: 'local',
        team: report.local,
        canEdit: true,
        isFieldDirty: (_s, id, field) => id === playerId && field === 'T',
        getFieldError: () => null,
        onActionChange: () => {},
      }),
    )
    expect(html).toContain('border-amber-400')
  })

  it('MatchOperationBanner muestra reintentos en error recuperable', () => {
    const operationError = normalizeOperationError('TIMEOUT')
    const html = renderToStaticMarkup(
      MatchOperationBanner({
        operation: 'error',
        operationLabel: 'Error',
        variant: 'error',
        busy: false,
        operationError,
        recovery: { preserveDirty: true, canRetrySave: true, canRetryFinalize: false, canReload: false },
        canRetrySave: true,
        canRetryFinalize: false,
        canReload: false,
        onRetrySave: () => {},
        onDismissError: () => {},
      }),
    )
    expect(html).toContain('Reintentar guardar')
    expect(html).toContain('role="status"')
    expect(html).toContain(operationError.userMessage)
  })

  it('MatchHelpPanel abierto muestra sección de reglas', () => {
    const html = renderToStaticMarkup(
      MatchHelpPanel({
        open: true,
        content: {
          hasContent: true,
          sections: [
            {
              id: 'rugby-rules',
              title: 'Reglas rugby (resumen)',
              items: [{ kind: 'tip', message: 'ΣT ≤ ΣE por equipo.' }],
            },
          ],
        },
        onClose: () => {},
      }),
    )
    expect(html).toContain('Ayuda — acta del encuentro')
    expect(html).toContain('ΣT ≤ ΣE por equipo')
  })

  it('MatchCloseBlockedModal lista incidencias', () => {
    const html = renderToStaticMarkup(
      MatchCloseBlockedModal({
        open: true,
        issues: [{ code: 'TEST', message: 'Error de prueba' }],
        onDismiss: () => {},
      }),
    )
    expect(html).toContain('No se puede cerrar el acta')
    expect(html).toContain('Error de prueba')
  })

  it('MatchRefereeField renderiza input de árbitro', () => {
    const html = renderToStaticMarkup(
      MatchRefereeField({
        value: 'Árbitro',
        readOnly: false,
        dirty: true,
        onChange: () => {},
      }),
    )
    expect(html).toContain('Árbitro')
    expect(html).toContain('match-referee-name')
    expect(html).toContain('border-amber-400')
  })

  it('MatchTeamObservationsField renderiza textarea por equipo', () => {
    const html = renderToStaticMarkup(
      MatchTeamObservationsField({
        side: 'local',
        teamName: 'LOCAL',
        value: 'Nota',
        readOnly: false,
        onChange: () => {},
      }),
    )
    expect(html).toContain('Observaciones — LOCAL')
    expect(html).toContain('Nota')
  })

  it('MatchFinalizeConfirmModal muestra resumen y confirmación (cierre sin acciones)', () => {
    const report = emptyMatchReport()
    const html = renderToStaticMarkup(
      MatchFinalizeConfirmModal({
        open: true,
        busy: false,
        score: report.score,
        result: 'draw',
        matchStatus: report.context.matchStatus,
        teamLocalName: report.context.equipoLocal,
        teamVisitName: report.context.equipoVisitante,
        variant: 'empty_close',
        onCancel: () => {},
        onConfirm: () => {},
      }),
    )
    expect(html).toContain('Confirmar cierre del acta')
    expect(html).toContain('Marcador')
    expect(html).toContain('Resultado')
    expect(html).toContain('Estado del partido')
    expect(html).toContain('El acta no contiene acciones registradas')
    expect(html).toContain('Volver al acta')
    expect(html).toContain('Confirmar cierre')
  })

  it('MatchClosurePanel deshabilita acciones cuando canFinalize/canSave son false', () => {
    const html = renderToStaticMarkup(
      MatchClosurePanel({
        canSave: false,
        canFinalize: false,
        busy: false,
        isReadOnly: false,
        onSave: () => {},
        onFinalize: () => {},
        onRecalculate: () => {},
        onReset: () => {},
      }),
    )
    expect(html).toContain('Cerrar acta')
    expect(html).toContain('disabled')
  })

  it('MatchActionsTable incluye fila Ensayo castigo en fixture', () => {
    const report = emptyMatchReport()
    const html = renderToStaticMarkup(
      createElement(MatchActionsTable, {
        side: 'local',
        team: report.local,
        canEdit: true,
        isFieldDirty: () => false,
        getFieldError: () => null,
        onActionChange: () => {},
      }),
    )
    expect(html).toContain('Ensayo castigo')
    expect(html).toContain('Castigo')
    expect(html).toContain('aria-label="E, Jugador L1"')
    expect(html).toContain('data-match-action-input')
    expect(html).toContain('focus-visible:ring-sky-500')
  })

  it('MatchFinalizeConfirmModal muestra mensaje de cierre normal', () => {
    const report = emptyMatchReport()
    const html = renderToStaticMarkup(
      MatchFinalizeConfirmModal({
        open: true,
        busy: false,
        score: report.score,
        result: 'draw',
        matchStatus: report.context.matchStatus,
        teamLocalName: report.context.equipoLocal,
        teamVisitName: report.context.equipoVisitante,
        variant: 'normal',
        onCancel: () => {},
        onConfirm: () => {},
      }),
    )
    expect(html).toContain('Va a cerrar definitivamente el acta del encuentro')
    expect(html).toContain('Tras el cierre no podrá editar la información')
  })

  it('MatchFinalizeConfirmModal indica atajos de teclado', () => {
    const report = emptyMatchReport()
    const html = renderToStaticMarkup(
      MatchFinalizeConfirmModal({
        open: true,
        busy: false,
        score: report.score,
        result: 'draw',
        matchStatus: report.context.matchStatus,
        teamLocalName: report.context.equipoLocal,
        teamVisitName: report.context.equipoVisitante,
        variant: 'normal',
        onCancel: () => {},
        onConfirm: () => {},
      }),
    )
    expect(html).toContain('Enter confirma')
    expect(html).toContain('data-dialog-primary')
  })
})
