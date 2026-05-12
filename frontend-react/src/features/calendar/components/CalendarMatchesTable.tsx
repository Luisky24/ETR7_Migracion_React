import type { CalendarMatchDto, CalendarMatchState } from '../contracts/calendar.contract'

const ESTADO_PARTIDO_LABEL: Record<CalendarMatchState, string> = {
  sin_alineacion: 'Sin alineación',
  alineacion_parcial: 'Alineación parcial',
  acta_abierta: 'Acta abierta',
  acta_cerrada: 'Acta cerrada',
  unspecified: '—',
}

interface CalendarMatchesTableProps {
  readonly matches: readonly CalendarMatchDto[]
}

export function CalendarMatchesTable({ matches }: CalendarMatchesTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-3 sm:px-4">
              Grupo
            </th>
            <th scope="col" className="px-3 py-3 sm:px-4">
              Local
            </th>
            <th scope="col" className="px-3 py-3 sm:px-4">
              Visitante
            </th>
            <th scope="col" className="px-3 py-3 sm:px-4">
              Hora
            </th>
            <th scope="col" className="px-3 py-3 sm:px-4">
              Campo
            </th>
            <th scope="col" className="px-3 py-3 sm:px-4">
              Resultado
            </th>
            <th scope="col" className="px-3 py-3 sm:px-4">
              Estado partido
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-800">
          {matches.map((m) => (
            <tr key={`${m.encuentroId}|${m.referenciaEncuentro}`} className="hover:bg-slate-50/80">
              <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">{m.grupo || '—'}</td>
              <td className="px-3 py-2.5 sm:px-4">{m.equipoLocal}</td>
              <td className="px-3 py-2.5 sm:px-4">{m.equipoVisitante}</td>
              <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">{m.hora || '—'}</td>
              <td className="max-w-[10rem] truncate px-3 py-2.5 sm:max-w-xs sm:px-4">{m.campo || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">{m.resultadoDisplay || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4 sm:text-sm">
                {ESTADO_PARTIDO_LABEL[m.estadoPartido]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
