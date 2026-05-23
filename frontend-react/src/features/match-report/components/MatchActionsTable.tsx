import type { MatchTeam, TeamSide } from '../contracts'
import type { ActionFieldKey } from '../types/matchReportForm.types'
import { ensurePenaltyTryPlayerOnTeam, isPenaltyTryPlayer } from '../presentation/penaltyTryPlayer'
import {
  preventWheelChangeValue,
  registerActionInput,
  rememberActionInputFocus,
  selectInputValue,
  shouldAutoSelectOnFocus,
} from '../presentation/smartEntryFocus'
import { useCallback, useMemo, useRef } from 'react'

const ACTION_COLUMNS: readonly { readonly key: ActionFieldKey; readonly label: string }[] = [
  { key: 'E', label: 'E' },
  { key: 'T', label: 'T' },
  { key: 'PC', label: 'PC' },
  { key: 'Tar', label: 'Tar' },
]

export type ActionCellCoord = Readonly<{ row: number; col: number }>

export function resolveNextActionCell(
  current: ActionCellCoord,
  intent: 'next' | 'prev',
  bounds: Readonly<{ rows: number; cols: number }>,
): ActionCellCoord {
  const { row, col } = current
  const { rows, cols } = bounds
  if (rows <= 0 || cols <= 0) return { row: 0, col: 0 }

  if (intent === 'next') {
    if (col < cols - 1) return { row, col: col + 1 }
    if (row < rows - 1) return { row: row + 1, col: 0 }
    return { row: rows - 1, col: cols - 1 }
  }

  if (col > 0) return { row, col: col - 1 }
  if (row > 0) return { row: row - 1, col: cols - 1 }
  return { row: 0, col: 0 }
}

function cellKey(side: TeamSide, playerId: string, field: ActionFieldKey): string {
  return `${side}:${playerId}:${field}`
}

export interface MatchActionsTableProps {
  readonly side: TeamSide
  readonly team: MatchTeam
  readonly canEdit: boolean
  readonly isFieldDirty: (side: TeamSide, playerId: string, field: ActionFieldKey) => boolean
  readonly getFieldError: (side: TeamSide, playerId: string, field: ActionFieldKey) => string | null
  readonly onActionChange: (side: TeamSide, playerId: string, field: ActionFieldKey, raw: string) => void
}

export function MatchActionsTable({
  side,
  team,
  canEdit,
  isFieldDirty,
  getFieldError,
  onActionChange,
}: MatchActionsTableProps) {
  const displayTeam = ensurePenaltyTryPlayerOnTeam(team)
  const players = displayTeam.players

  const inputRefs = useRef(new Map<string, HTMLInputElement>())
  /** 'pointer' si el foco viene de click; null/keyboard si TAB o navegación programática. */
  const focusIntentRef = useRef<'keyboard' | 'pointer' | null>(null)

  const registerInputRef = useCallback(
    (key: string) => (el: HTMLInputElement | null) => {
      registerActionInput(key, el)
      if (!el) {
        inputRefs.current.delete(key)
        return
      }
      inputRefs.current.set(key, el)
    },
    [],
  )

  const bounds = useMemo(
    () => ({ rows: players.length, cols: ACTION_COLUMNS.length }),
    [players.length],
  )

  const focusCell = useCallback(
    (rowIdx: number, colIdx: number) => {
      const player = players[rowIdx]
      const col = ACTION_COLUMNS[colIdx]
      if (!player || !col) return
      const key = cellKey(side, player.playerId, col.key)
      const el = inputRefs.current.get(key)
      if (!el) return
      focusIntentRef.current = 'keyboard'
      el.focus()
      selectInputValue(el)
      rememberActionInputFocus(key)
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      focusIntentRef.current = null
    },
    [players, side],
  )

  const handleInputFocus = useCallback(
    (key: string, el: HTMLInputElement) => {
      rememberActionInputFocus(key)
      const intent = focusIntentRef.current ?? 'keyboard'
      focusIntentRef.current = null
      if (shouldAutoSelectOnFocus(intent)) {
        requestAnimationFrame(() => selectInputValue(el))
      }
    },
    [],
  )

  return (
    <div className="relative overflow-x-auto sm:overflow-x-visible">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-auto" />
          <col className="w-9 sm:w-10" />
          <col className="w-11 sm:w-11" />
          <col className="w-11 sm:w-11" />
          <col className="w-11 sm:w-11" />
          <col className="w-11 sm:w-11" />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600">
            <th className="px-2 py-2 sm:px-3">Jugador</th>
            <th className="px-0.5 py-2 text-center sm:px-1">Dorsal</th>
            {ACTION_COLUMNS.map((col) => (
              <th key={col.key} className="px-0.5 py-2 text-center sm:px-1">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player, rowIdx) => {
            const fictitious = isPenaltyTryPlayer(player.playerId)
            return (
              <tr
                key={player.playerId}
                className={`border-b border-slate-100 transition-colors duration-150 ${
                  fictitious ? 'bg-amber-50/70' : ''
                }`}
              >
                <td className="px-2 py-1.5 sm:px-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      title={player.jugador}
                      className={`min-w-0 flex-1 truncate font-medium ${
                        fictitious ? 'text-slate-600' : 'text-slate-800'
                      }`}
                    >
                      {player.jugador}
                    </span>
                    {player.isCaptain ? (
                      <span className="shrink-0 text-[10px] font-semibold uppercase text-amber-700">
                        (C)
                      </span>
                    ) : null}
                    {fictitious ? (
                      <span className="shrink-0 inline-flex whitespace-nowrap rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                        Castigo
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-1 py-1.5 text-center tabular-nums text-slate-600">
                  {fictitious ? '—' : player.dorsal}
                </td>
                {ACTION_COLUMNS.map((col, colIdx) => {
                  const dirty = isFieldDirty(side, player.playerId, col.key)
                  const err = getFieldError(side, player.playerId, col.key)
                  const key = cellKey(side, player.playerId, col.key)
                  const ariaLabel = `${col.label}, ${player.jugador}${fictitious ? ', ensayo castigo' : ''}`
                  return (
                    <td
                      key={col.key}
                      className="relative px-1 py-1 text-center focus-within:z-10"
                    >
                      <input
                        type="number"
                        min={0}
                        max={99}
                        disabled={!canEdit}
                        value={player.actions[col.key]}
                        aria-label={ariaLabel}
                        aria-invalid={!!err}
                        title={err ?? undefined}
                        inputMode="numeric"
                        data-match-action-input
                        data-side={side}
                        data-action-key={key}
                        ref={registerInputRef(key)}
                        className={`relative h-8 w-11 rounded border px-1 py-1 text-center text-sm tabular-nums transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 sm:h-9 sm:w-11 sm:text-base focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 active:ring-1 active:ring-sky-400 ${
                          err
                            ? 'border-red-400 bg-red-50'
                            : dirty
                              ? 'border-amber-400 bg-amber-50/90 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.35)]'
                              : 'border-slate-300'
                        }`}
                        onChange={(e) =>
                          onActionChange(side, player.playerId, col.key, e.target.value)
                        }
                        onPointerDown={() => {
                          focusIntentRef.current = 'pointer'
                        }}
                        onFocus={(e) => handleInputFocus(key, e.currentTarget)}
                        onWheel={(e) => preventWheelChangeValue(e.currentTarget)}
                        onKeyDown={(e) => {
                          if (!canEdit) return

                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const next = resolveNextActionCell(
                              { row: rowIdx, col: colIdx },
                              e.shiftKey ? 'prev' : 'next',
                              bounds,
                            )
                            focusCell(next.row, next.col)
                            return
                          }

                          if (!e.ctrlKey) return
                          if (e.key === 'ArrowLeft') {
                            e.preventDefault()
                            const next = resolveNextActionCell(
                              { row: rowIdx, col: colIdx },
                              'prev',
                              bounds,
                            )
                            focusCell(next.row, next.col)
                          } else if (e.key === 'ArrowRight') {
                            e.preventDefault()
                            const next = resolveNextActionCell(
                              { row: rowIdx, col: colIdx },
                              'next',
                              bounds,
                            )
                            focusCell(next.row, next.col)
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            focusCell(Math.max(0, rowIdx - 1), colIdx)
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            focusCell(Math.min(bounds.rows - 1, rowIdx + 1), colIdx)
                          }
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
