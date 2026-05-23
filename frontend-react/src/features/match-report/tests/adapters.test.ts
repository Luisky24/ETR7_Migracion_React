import { describe, expect, it } from 'vitest'
import { matchContextFromCalendar } from '../adapters/calendar.mapper'
import { mapGasTeamLineupToMatchTeam, parseLegacyJugadorRow, teamWireHasActaStats } from '../adapters/alignment.mapper'
import {
  adaptLoadMatchReportResponse,
  buildGasPayloadFromReport,
  mapGasErrorToClosureResult,
} from '../adapters/match-report.mapper'
import { legacyEncuentroFromContext, legacyEncuentroToArray, parseScoreFromResultadoDisplay } from '../adapters/legacyEncuentro'
import { buildMatchPersistenceDto } from '../utils/persistenceDto'
import { baseContext, emptyMatchReport } from './fixtures'

describe('calendar.mapper', () => {
  it('maps CalendarMatchDto to MatchContext', () => {
    const ctx = matchContextFromCalendar('M', 'Fase I', {
      encuentroId: 'A|LOC|VIS',
      grupo: 'A',
      equipoLocal: 'LOC',
      equipoVisitante: 'VIS',
      hora: '10:00',
      campo: 'C1',
      resultadoDisplay: '12 - 7',
      estadoAlineacionesDisplay: 'C - C',
      estadoPartido: 'acta_abierta',
      referenciaEncuentro: '',
    })
    expect(ctx.encuentroId).toBe('A|LOC|VIS')
    expect(ctx.matchStatus).toBe('acta_abierta')
  })
})

describe('alignment.mapper', () => {
  it('parses lineup jugador row (5 cols)', () => {
    const j = parseLegacyJugadorRow(['Ana', 'X', '', '', 7])
    expect(j?.hasActaStats).toBe(false)
    expect(j?.dorsal).toBe(7)
  })

  it('parses acta jugador row (9 cols)', () => {
    const j = parseLegacyJugadorRow(['Ana', 'X', '', '', 7, 1, 0, 0, 0])
    expect(j?.hasActaStats).toBe(true)
    expect(j?.E).toBe(1)
  })

  it('maps team wire to MatchTeam', () => {
    const team = mapGasTeamLineupToMatchTeam(
      {
        equipo: 'LOC',
        delegado: 'D',
        entrenador: 'E',
        jugadores: [['Ana', 'X', '', '', 7]],
      },
      'local',
      'LOC',
    )
    expect(team?.players).toHaveLength(1)
    expect(teamWireHasActaStats({ jugadores: [['Ana', 'X', '', '', 7, 1, 0, 0, 0]] })).toBe(true)
  })
})

describe('match-report.mapper', () => {
  it('adapts load response with lineup only', () => {
    const context = baseContext({ matchStatus: 'acta_abierta', resultadoDisplay: '5 - 3' })
    const res = adaptLoadMatchReportResponse(context, [
      {
        equipo: 'LOCAL',
        delegado: '',
        entrenador: '',
        jugadores: [['J1', 'X', '', '', 1]],
      },
      {
        equipo: 'VISITANTE',
        delegado: '',
        entrenador: '',
        jugadores: [['J2', 'X', '', '', 2]],
      },
    ])
    expect(res.fromActaSnapshot).toBe(false)
    expect(res.report.local.players).toHaveLength(1)
    expect(res.report.score.local).toBeGreaterThanOrEqual(0)
  })

  it('adapts load response with acta metadata (tercer elemento)', () => {
    const context = baseContext({ matchStatus: 'acta_abierta' })
    const res = adaptLoadMatchReportResponse(context, [
      {
        equipo: 'LOCAL',
        delegado: '',
        entrenador: '',
        jugadores: [['J1', 'X', '', '', 1]],
        observaciones: 'Wire local',
      },
      {
        equipo: 'VISITANTE',
        delegado: '',
        entrenador: '',
        jugadores: [['J2', 'X', '', '', 2]],
      },
      {
        arbitro: 'Árbitro Wire',
        incidencias: 'Inc wire',
        observacionesVisitante: 'Obs visit wire',
      },
    ])
    expect(res.report.referee?.name).toBe('Árbitro Wire')
    expect(res.report.incidencias).toBe('Inc wire')
    expect(res.report.local.observaciones).toBe('Wire local')
    expect(res.report.visitante.observaciones).toBe('Obs visit wire')
  })

  it('builds gas payload with legacy encuentro array', () => {
    const report = emptyMatchReport()
    const dto = buildMatchPersistenceDto(report, false)
    const payload = buildGasPayloadFromReport(dto, report)
    expect(Array.isArray(payload.encuentro)).toBe(true)
    expect(payload.encuentro[0]).toBe(report.context.grupo)
    expect(payload.cerrar).toBe(false)
  })

  it('builds gas payload with arbitro when referee set', () => {
    const report = { ...emptyMatchReport(), referee: { name: 'Ref Test' } }
    const dto = buildMatchPersistenceDto(report, false)
    const payload = buildGasPayloadFromReport(dto, report)
    expect(payload.arbitro).toBe('Ref Test')
  })

  it('maps server errors to closure codes', () => {
    const r = mapGasErrorToClosureResult(new Error('Encuentro sin referencia_encuentro'))
    expect(r.errorCode).toBe('MISSING_REFERENCIA_F2')
  })
})

describe('legacyEncuentro', () => {
  it('roundtrips context to array', () => {
    const ctx = baseContext()
    const arr = legacyEncuentroToArray(legacyEncuentroFromContext(ctx))
    expect(arr[1]).toBe(ctx.equipoLocal)
  })

  it('parses score display', () => {
    expect(parseScoreFromResultadoDisplay('12 - 8')).toEqual({ local: 12, visitante: 8 })
  })
})
