import type { MatchRefDto } from '../contracts/teamLineupContext.contract'

interface AlineacionInfoEncuentroProps {
  readonly match: MatchRefDto
}

function formatHora(hora: string | null): string {
  if (!hora?.trim()) return '—'
  const t = hora.trim()
  if (/^\d{1,2}:\d{2}$/.test(t)) return t
  return t
}

export function AlineacionInfoEncuentro({ match }: AlineacionInfoEncuentroProps) {
  const local = match.equipoLocal?.trim() || '—'
  const visitante = match.equipoVisitante?.trim() || '—'

  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-5 text-center shadow-sm">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{local}</span>
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400" aria-hidden>
          vs
        </span>
        <span className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{visitante}</span>
      </div>
      <div className="mx-auto mt-4 flex max-w-2xl flex-col items-center justify-center gap-2 text-sm text-slate-700 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 sm:gap-y-2">
        <p className="whitespace-nowrap">
          <span className="font-medium text-slate-500">Grupo </span>
          {match.grupo?.trim() || '—'}
        </p>
        <p className="hidden text-slate-300 sm:inline" aria-hidden>
          |
        </p>
        <p className="whitespace-nowrap">
          <span className="font-medium text-slate-500">Campo </span>
          {match.campo?.trim() || '—'}
        </p>
        <p className="hidden text-slate-300 sm:inline" aria-hidden>
          |
        </p>
        <p className="whitespace-nowrap">
          <span className="font-medium text-slate-500">Hora </span>
          {formatHora(match.hora)}
        </p>
      </div>
    </section>
  )
}
