import { useMemo } from 'react'
import type { TeamLineupPlayerDto } from '../contracts/teamLineupContext.contract'
import { computeDuplicateDorsals } from '../utils/lineupPlayerPatch'
import { AlineacionJugadorRow } from './AlineacionJugadorRow'
import { PLAYER_LIST_GRID } from './playerListLayout'

function headerRowClass(isLockedLineup: boolean): string {
  return [
    PLAYER_LIST_GRID,
    'sticky top-0 z-10',
    'border-b border-slate-200',
    isLockedLineup ? 'bg-slate-100' : 'bg-slate-50',
    'px-3 py-2.5',
    'text-xs font-semibold uppercase tracking-wide text-slate-600',
    'shadow-[0_1px_0_0_rgba(15,23,42,0.06)]',
  ].join(' ')
}

interface ListadoAlineacionJugadoresProps {
  readonly jugadores: readonly TeamLineupPlayerDto[]
  readonly canEdit: boolean
  readonly isLockedLineup: boolean
  readonly onToggleTitular: (index: number) => void
  readonly onToggleSuplente: (index: number) => void
  readonly onToggleCapitan: (index: number) => void
  readonly onDorsalChange: (index: number, dorsal: number | null) => void
}

export function ListadoAlineacionJugadores({
  jugadores,
  canEdit,
  isLockedLineup,
  onToggleTitular,
  onToggleSuplente,
  onToggleCapitan,
  onDorsalChange,
}: ListadoAlineacionJugadoresProps) {
  const duplicateDorsals = useMemo(() => computeDuplicateDorsals(jugadores), [jugadores])

  return (
    <section
      className={[
        'flex flex-col overflow-hidden rounded-lg border shadow-sm',
        isLockedLineup ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <div
        className="max-h-[min(32rem,55vh)] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
        role="region"
        aria-label="Listado de jugadores"
      >
        <div className={headerRowClass(isLockedLineup)} role="row">
          <span role="columnheader">Jugador</span>
          <span className="text-center" role="columnheader">
            T
          </span>
          <span className="text-center" role="columnheader">
            S
          </span>
          <span className="text-center" role="columnheader">
            C
          </span>
          <span className="text-center" role="columnheader">
            Dorsal
          </span>
        </div>
        <div className="px-3 pb-4 pt-1">
          {jugadores.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Sin jugadores en el modelo.</p>
          ) : (
            jugadores.map((j, i) => (
              <AlineacionJugadorRow
                key={`${j.nombre}-${i}`}
                player={j}
                index={i}
                canEdit={canEdit}
                isLockedLineup={isLockedLineup}
                dorsalDuplicated={j.dorsal != null && duplicateDorsals.has(j.dorsal)}
                onToggleTitular={onToggleTitular}
                onToggleSuplente={onToggleSuplente}
                onToggleCapitan={onToggleCapitan}
                onDorsalChange={onDorsalChange}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
