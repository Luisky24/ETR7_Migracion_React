import { useCallback, useMemo } from 'react'
import type { TeamLineupContextResponse, TeamLineupPlayerDto } from '../contracts/teamLineupContext.contract'
import {
  setPlayerDorsal,
  toggleCapitan,
  toggleSuplente,
  toggleTitular,
} from '../utils/lineupPlayerPatch'
import type { LineupRuntimeState } from '../utils/lineupRuntimeState'
import { AlineacionActions } from './AlineacionActions'
import { AlineacionFeedbackZone } from './AlineacionFeedbackZone'
import { AlineacionInfoEncuentro } from './AlineacionInfoEncuentro'
import { ListadoAlineacionJugadores } from './ListadoAlineacionJugadores'

import type { TeamLineupDraftState } from '../types/teamLineupDraft.types'

export type { TeamLineupDraftState }

interface TeamLineupContextPanelProps {
  readonly data: TeamLineupContextResponse
  readonly draft: TeamLineupDraftState
  readonly runtime: LineupRuntimeState
  readonly onDraftChange: (next: TeamLineupDraftState) => void
  readonly softWarnings: readonly string[]
  readonly onSave?: () => void
  readonly saveBusy?: boolean
  readonly saveError?: string | null
  readonly confirmHardErrors: readonly string[]
  readonly onRequestConfirm?: () => void
  readonly confirmBusy?: boolean
}

export function TeamLineupContextPanel({
  data,
  draft,
  runtime,
  onDraftChange,
  softWarnings,
  onSave,
  saveBusy,
  saveError,
  confirmHardErrors,
  onRequestConfirm,
  confirmBusy,
}: TeamLineupContextPanelProps) {
  const { context } = data
  const { isLockedLineup, lockReason } = runtime.ui
  const { canEditFields, canOfferSave, canOfferConfirm } = runtime

  const roster = canEditFields ? draft.jugadores : context.jugadores
  const delegadoVal = canEditFields ? draft.delegado : context.delegado
  const entrenadorVal = canEditFields ? draft.entrenador : context.entrenador

  const canSave = canOfferSave && !!onSave
  const canConfirm = canOfferConfirm && !!onRequestConfirm

  const patchDraft = useCallback(
    (patch: Partial<TeamLineupDraftState>) => {
      onDraftChange({ ...draft, ...patch })
    },
    [draft, onDraftChange],
  )

  const patchJugadores = useCallback(
    (jugadores: TeamLineupPlayerDto[]) => {
      onDraftChange({ ...draft, jugadores })
    },
    [draft, onDraftChange],
  )

  const handleToggleTitular = useCallback(
    (index: number) => {
      if (!canEditFields) return
      patchJugadores(toggleTitular(draft.jugadores, index))
    },
    [canEditFields, draft.jugadores, patchJugadores],
  )

  const handleToggleSuplente = useCallback(
    (index: number) => {
      if (!canEditFields) return
      patchJugadores(toggleSuplente(draft.jugadores, index))
    },
    [canEditFields, draft.jugadores, patchJugadores],
  )

  const handleToggleCapitan = useCallback(
    (index: number) => {
      if (!canEditFields) return
      patchJugadores(toggleCapitan(draft.jugadores, index))
    },
    [canEditFields, draft.jugadores, patchJugadores],
  )

  const handleDorsalChange = useCallback(
    (index: number, dorsal: number | null) => {
      if (!canEditFields) return
      patchJugadores(setPlayerDorsal(draft.jugadores, index, dorsal))
    },
    [canEditFields, draft.jugadores, patchJugadores],
  )

  const lockedBanner = useMemo(() => {
    if (!isLockedLineup) return null
    return lockReason ?? 'La alineación no se puede modificar en este estado.'
  }, [isLockedLineup, lockReason])

  return (
    <div
      className={[
        'space-y-5',
        isLockedLineup ? 'rounded-lg border border-slate-300 bg-slate-50/50 p-4 sm:p-5' : '',
      ].join(' ')}
    >
      {lockedBanner ? (
        <p
          className="rounded-md border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-800"
          role="status"
        >
          {lockedBanner}
        </p>
      ) : null}

      <AlineacionInfoEncuentro match={context.match} />

      <section className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Staff técnico</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-500" htmlFor="tl-delegado">
              Delegado
            </label>
            <input
              id="tl-delegado"
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm read-only:bg-slate-100 read-only:text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100"
              value={delegadoVal}
              readOnly={!canEditFields}
              disabled={!canEditFields}
              onChange={(e) => {
                patchDraft({ delegado: e.target.value })
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500" htmlFor="tl-entrenador">
              Entrenador
            </label>
            <input
              id="tl-entrenador"
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm read-only:bg-slate-100 read-only:text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100"
              value={entrenadorVal}
              readOnly={!canEditFields}
              disabled={!canEditFields}
              onChange={(e) => {
                patchDraft({ entrenador: e.target.value })
              }}
            />
          </div>
        </div>
      </section>

      <AlineacionActions
        isLockedLineup={isLockedLineup}
        canSave={canSave}
        canConfirm={canConfirm}
        saveBusy={saveBusy}
        confirmBusy={confirmBusy}
        confirmHardErrors={confirmHardErrors}
        onSave={onSave}
        onRequestConfirm={onRequestConfirm}
      />

      <AlineacionFeedbackZone
        softWarnings={softWarnings}
        confirmHardErrors={confirmHardErrors}
        saveError={saveError}
        isLockedLineup={isLockedLineup}
      />

      <ListadoAlineacionJugadores
        jugadores={roster}
        canEdit={canEditFields}
        isLockedLineup={isLockedLineup}
        onToggleTitular={handleToggleTitular}
        onToggleSuplente={handleToggleSuplente}
        onToggleCapitan={handleToggleCapitan}
        onDorsalChange={handleDorsalChange}
      />
    </div>
  )
}
