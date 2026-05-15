import type { TeamLineupPlayerDto } from '../contracts/teamLineupContext.contract'
import { isDorsalInvalidForPlayer } from '../utils/lineupPlayerPatch'
import { PLAYER_LIST_GRID } from './playerListLayout'

interface AlineacionJugadorRowProps {
  readonly player: TeamLineupPlayerDto
  readonly index: number
  readonly canEdit: boolean
  readonly isLockedLineup: boolean
  readonly dorsalDuplicated: boolean
  readonly onToggleTitular: (index: number) => void
  readonly onToggleSuplente: (index: number) => void
  readonly onToggleCapitan: (index: number) => void
  readonly onDorsalChange: (index: number, dorsal: number | null) => void
}

function ToggleButton({
  label,
  active,
  disabled,
  onClick,
  title,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm font-semibold transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1',
        disabled ? 'cursor-not-allowed opacity-50' : '',
        active
          ? 'border-sky-700 bg-sky-700 text-white'
          : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

const ROW_GRID = `${PLAYER_LIST_GRID} border-b border-slate-100 py-3 last:border-b-0`

export function AlineacionJugadorRow({
  player,
  index,
  canEdit,
  isLockedLineup,
  dorsalDuplicated,
  onToggleTitular,
  onToggleSuplente,
  onToggleCapitan,
  onDorsalChange,
}: AlineacionJugadorRowProps) {
  const locked = isLockedLineup || !canEdit
  const dorsalInvalid = isDorsalInvalidForPlayer(player)
  const capitanDisabled = locked || !player.titular

  const dorsalInputClass = [
    'w-full max-w-[4rem] rounded-md border px-1 py-1 text-center text-sm tabular-nums',
    locked ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600' : 'border-slate-300 bg-white',
    dorsalDuplicated || dorsalInvalid ? 'border-amber-500 ring-1 ring-amber-300' : '',
  ].join(' ')

  return (
    <div className={[ROW_GRID, locked ? 'bg-slate-50/80' : ''].join(' ')} role="row">
      <span className="min-w-0 truncate text-sm text-slate-900" role="rowheader">
        {player.nombre}
      </span>
      <ToggleButton
        label="T"
        active={player.titular}
        disabled={locked}
        onClick={() => {
          onToggleTitular(index)
        }}
        title="Titular"
      />
      <ToggleButton
        label="S"
        active={player.suplente}
        disabled={locked}
        onClick={() => {
          onToggleSuplente(index)
        }}
        title="Suplente"
      />
      <ToggleButton
        label="C"
        active={player.capitan}
        disabled={capitanDisabled}
        onClick={() => {
          onToggleCapitan(index)
        }}
        title={player.titular ? 'Capitán' : 'Solo titulares pueden ser capitán'}
      />
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Dorsal de ${player.nombre}`}
        readOnly={locked}
        disabled={locked}
        className={dorsalInputClass}
        value={player.dorsal != null && player.dorsal > 0 ? String(player.dorsal) : ''}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2)
          const n = v === '' ? null : parseInt(v, 10)
          onDorsalChange(index, n != null && !Number.isNaN(n) && n > 0 ? n : null)
        }}
      />
    </div>
  )
}
