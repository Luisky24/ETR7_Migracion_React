import { describe, expect, it } from 'vitest'
import {
  CLOSE_EMPTY_MATCH_WARNING_CODE,
  validateClose,
  validateConversionsVsTries,
  validateDraftSave,
  validateEditActions,
  validateFinalizeClose,
  validateManualScoreUpdate,
  validateScoreCoherence,
} from '../domain/validation'
import { DEFAULT_CLOSE_POLICY } from '../domain/finalization'
import { recalculateMatchReport } from '../domain/scoring'
import { baseContext, emptyMatchReport, playerLine } from './fixtures'

describe('validation', () => {
  it('bloquea guardar borrador sin acciones', () => {
    const report = emptyMatchReport()
    const result = validateDraftSave(report)
    expect(result.ok).toBe(false)
    expect(result.errors[0]?.code).toBe('DRAFT_NO_ACTIONS')
  })

  it('permite guardar con al menos una acción', () => {
    let report = emptyMatchReport()
    report = recalculateMatchReport({
      ...report,
      local: {
        ...report.local,
        players: [playerLine('J', 1, { E: 1 }, { titular: true })],
      },
    })
    expect(validateDraftSave(report).ok).toBe(true)
  })

  it('exige referencia en Fase II', () => {
    const report = emptyMatchReport(
      baseContext({ phase: 'Fase II', referenciaEncuentro: '' }),
    )
    const withAction = recalculateMatchReport({
      ...report,
      local: {
        ...report.local,
        players: [playerLine('J', 1, { E: 1 }, { titular: true })],
      },
    })
    expect(validateDraftSave(withAction).ok).toBe(false)
  })

  it('warn marcador inconsistente con acciones', () => {
    let report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 2 }, { titular: true })],
      },
    })
    report = { ...report, score: { local: 0, visitante: 0 } }
    const result = validateScoreCoherence(report)
    expect(result.ok).toBe(true)
    expect(result.warnings.some((w) => w.code === 'SCORE_ACTION_MISMATCH')).toBe(true)
  })

  it('cierre válido con acciones', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 1 }, { titular: true })],
      },
    })
    const result = validateClose({
      report,
      allowScoreOnlyClose: DEFAULT_CLOSE_POLICY.allowScoreOnlyClose,
    })
    expect(result.ok).toBe(true)
  })

  it('cierre score-only sin acciones si política lo permite', () => {
    const report = {
      ...emptyMatchReport(),
      score: { local: 7, visitante: 3 },
    }
    const result = validateClose({
      report,
      allowScoreOnlyClose: true,
    })
    expect(result.ok).toBe(true)
    expect(result.warnings.some((w) => w.code === CLOSE_EMPTY_MATCH_WARNING_CODE)).toBe(true)
  })

  it('0-0 sin acciones: warning en panel y cierre permitido con confirmación', () => {
    const report = emptyMatchReport()
    const input = { report, allowScoreOnlyClose: true as const }

    const panel = validateClose(input)
    expect(panel.ok).toBe(true)
    expect(panel.warnings.some((w) => w.code === CLOSE_EMPTY_MATCH_WARNING_CODE)).toBe(true)

    expect(validateFinalizeClose(input).ok).toBe(false)
    expect(validateFinalizeClose({ ...input, confirmEmptyClose: true }).ok).toBe(true)
  })

  it('rechaza ΣT > ΣE agregado por equipo', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 1, T: 2 }, { titular: true })],
      },
    })
    expect(validateConversionsVsTries(report).ok).toBe(false)
    expect(validateEditActions(report).ok).toBe(false)
    expect(validateConversionsVsTries(report).errors[0]?.code).toBe('CONVERSIONS_EXCEED_TRIES')
    expect(validateConversionsVsTries(report).errors[0]?.message).toMatch(/equipo/i)
    expect(validateConversionsVsTries(report).errors[0]?.field).toBe('team:local:conversions')
  })

  it('acepta reparto válido: filas con T>E individual pero ΣT <= ΣE equipo', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [
          playerLine('A', 1, { E: 1, T: 0 }, { titular: true }),
          playerLine('B', 2, { E: 0, T: 1 }, { titular: true }),
        ],
      },
    })
    expect(validateConversionsVsTries(report).ok).toBe(true)
    expect(validateEditActions(report).ok).toBe(true)
  })

  it('acepta ΣT == ΣE agregado por equipo', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 2, T: 2 }, { titular: true })],
      },
    })
    expect(validateConversionsVsTries(report).ok).toBe(true)
  })

  it('rechaza ΣT > ΣE con varios jugadores en cancha', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [
          playerLine('A', 1, { E: 0, T: 1 }, { titular: true }),
          playerLine('B', 2, { E: 0, T: 1 }, { titular: true }),
        ],
      },
    })
    expect(validateConversionsVsTries(report).ok).toBe(false)
  })

  it('bloquea cierre si ΣT > ΣE agregado por equipo', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 0, T: 1 }, { titular: true })],
      },
    })
    const result = validateClose({
      report,
      allowScoreOnlyClose: DEFAULT_CLOSE_POLICY.allowScoreOnlyClose,
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'CONVERSIONS_EXCEED_TRIES')).toBe(true)
    expect(result.errors.find((e) => e.code === 'CONVERSIONS_EXCEED_TRIES')?.message).toMatch(
      /equipo/i,
    )
  })

  it('rechaza override manual con acciones', () => {
    const report = recalculateMatchReport({
      ...emptyMatchReport(),
      local: {
        ...emptyMatchReport().local,
        players: [playerLine('J', 1, { E: 1 }, { titular: true })],
      },
    })
    const result = validateManualScoreUpdate(report, { local: 5, visitante: 0 }, true)
    expect(result.ok).toBe(false)
  })
})
