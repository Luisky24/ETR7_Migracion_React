import type { LineupBadgeTone } from '../utils/lineupRuntimeState'

const BADGE_CLASS: Record<LineupBadgeTone, string> = {
  amber: 'bg-amber-100 text-amber-900 ring-amber-200',
  sky: 'bg-sky-100 text-sky-900 ring-sky-200',
  emerald: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  slate: 'bg-slate-200 text-slate-800 ring-slate-300',
  rose: 'bg-rose-100 text-rose-900 ring-rose-200',
}

interface AlineacionHeaderProps {
  readonly equipo: string
  readonly badgeLabel: string
  readonly badgeTone: LineupBadgeTone
  readonly onBackToCalendar: () => void
}

export function AlineacionHeader({ equipo, badgeLabel, badgeTone, onBackToCalendar }: AlineacionHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Alineación de {equipo || '—'}</h1>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${BADGE_CLASS[badgeTone]}`}
        >
          {badgeLabel}
        </span>
      </div>
      <button
        type="button"
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        onClick={onBackToCalendar}
      >
        Volver al calendario
      </button>
    </header>
  )
}
