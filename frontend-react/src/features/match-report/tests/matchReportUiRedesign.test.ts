import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MatchActionsTable } from '../components/MatchActionsTable'
import { MatchClosurePanel } from '../components/MatchClosurePanel'
import { MatchScoreCard } from '../components/MatchScoreCard'
import {
  PENALTY_TRY_PLAYER_NAME,
  ensurePenaltyTryPlayersOnReport,
} from '../presentation/penaltyTryPlayer'
import { emptyMatchReport } from './fixtures'

describe('match report UI redesign v2', () => {
  it('MatchScoreCard integra cabecera + resultado + puntuación en bloque superior', () => {
    const report = emptyMatchReport()
    const html = renderToStaticMarkup(
      MatchScoreCard({
        score: report.score,
        result: 'draw',
        headerTitle: `${report.context.equipoLocal} — ${report.context.equipoVisitante}`,
        headerSubtitle: `Grupo ${report.context.grupo} · ${report.context.phase} · ${report.context.hora} · ${report.context.campo}`,
        classificationRows: [
          { side: 'local', equipo: report.local.equipo, P: 0, BO: 0, BD: 0, Total: 0 },
          { side: 'visitante', equipo: report.visitante.equipo, P: 0, BO: 0, BD: 0, Total: 0 },
        ],
      }),
    )
    expect(html).toContain('Acta del encuentro')
    expect(html).toContain('Puntuación')
    expect(html).toContain('Empate')
    expect(html).toContain('>P<')
    expect(html).toContain('TOTAL')
    expect(html).not.toContain('MARCADOR')
    expect(html).not.toContain('Marcador')
    expect(html).not.toContain('Clasificación')
    expect(html).not.toContain('LOCAL M')
    expect(html).not.toContain('VISIT M')
  })

  it('MatchClosurePanel solo renderiza botones operativos', () => {
    const html = renderToStaticMarkup(
      MatchClosurePanel({
        canSave: true,
        canFinalize: true,
        busy: false,
        isReadOnly: false,
        onSave: () => {},
        onFinalize: () => {},
        onRecalculate: () => {},
        onReset: () => {},
      }),
    )
    expect(html).toContain('Guardar borrador')
    expect(html).toContain('Cerrar acta')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('Acta cerrada correctamente')
  })

  it('MatchActionsTable muestra jugador ficticio al final con badge Castigo', () => {
    const report = ensurePenaltyTryPlayersOnReport(emptyMatchReport())
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
    const penaltyIndex = html.lastIndexOf(PENALTY_TRY_PLAYER_NAME)
    const player1Index = html.indexOf('Jugador L1')
    expect(penaltyIndex).toBeGreaterThan(player1Index)
    expect(html).toContain('Castigo')
    expect(html).toContain('bg-amber-50')
  })

  it('ensurePenaltyTryPlayersOnReport añade fila por equipo sin duplicar', () => {
    const once = ensurePenaltyTryPlayersOnReport(emptyMatchReport())
    const twice = ensurePenaltyTryPlayersOnReport(once)
    expect(once.local.players.filter((p) => p.jugador === PENALTY_TRY_PLAYER_NAME)).toHaveLength(1)
    expect(twice.local.players).toHaveLength(once.local.players.length)
  })
})
