import { describe, expect, it } from 'vitest'
import { areLineupDraftsEqual } from '../lineupDraftCompare'
import { lineupDraftFromContext, reconcileLineupDraftFromWire } from '../lineupReconcile'
import { player } from './lineupTestFixtures'

describe('lineupReconcile', () => {
  const context = {
    match: {
      categoria: 'M',
      fase: 'Fase I',
      grupo: 'G1',
      equipoLocal: 'A',
      equipoVisitante: 'B',
      encuentroLabel: 'A - B',
      hora: null,
      campo: null,
      referenciaEncuentro: null,
      numFilaCalendario: null,
    },
    equipoOperativo: 'A',
    indLocalVisitante: 'L' as const,
    contrario: 'B',
    delegado: 'Delegado',
    entrenador: 'Entrenador',
    jugadores: [player('Jugador 1', { titular: true, dorsal: 1 })],
    nivelAcceso: 7,
    role: 'team',
    origenModelo: 'test',
  }

  it('lineupDraftFromContext clona jugadores', () => {
    const draft = lineupDraftFromContext(context)
    expect(draft.delegado).toBe('Delegado')
    expect(draft.jugadores[0]?.nombre).toBe('Jugador 1')
    expect(draft.jugadores).not.toBe(context.jugadores)
  })

  it('reconcileLineupDraftFromWire deja dirty-state limpio', () => {
    const result = reconcileLineupDraftFromWire({
      ok: true,
      context,
      permissions: {
        canRead: true,
        canEdit: true,
        canConfirm: true,
        canSelectTeam: false,
        protectedMode: false,
        reasonCodes: [],
      },
      workflow: {
        teamSlotState: 'E',
        opponentSlotState: 'P',
        matchState: 'alineacion_parcial',
        sheetStateEnc: null,
      },
      flags: {
        fromActaSnapshot: false,
        cerradaPorActa: false,
        staleRiskEncVsCalendar: false,
      },
      metadata: { version: 2, serverTime: '', etag: 'e1' },
    })
    expect(result).not.toBeNull()
    expect(areLineupDraftsEqual(result!.draft, result!.persistedSnapshot)).toBe(true)
  })

  it('wire error no produce reconcile', () => {
    expect(
      reconcileLineupDraftFromWire({
        ok: false,
        error: { code: 'ERR', message: 'fail' },
        metadata: { version: 2, serverTime: '', etag: null },
      }),
    ).toBeNull()
  })

  it('wire null no produce reconcile', () => {
    expect(reconcileLineupDraftFromWire(null)).toBeNull()
  })
})
