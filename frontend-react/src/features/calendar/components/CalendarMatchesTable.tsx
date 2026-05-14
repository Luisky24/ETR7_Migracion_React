import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '@/contexts/SessionContext'
import { calendarRecordKeyForDto } from '../adapters/calendar.adapter'
import type { CalendarCategory, CalendarMatchDto, CalendarPhase } from '../contracts/calendar.contract'
import { ROUTES } from '@/router/routes'
import { buildTeamLineupContextSearchParams } from '@/features/alineaciones-v2/utils/teamLineupContextQuery'
import { legacyNivelAccesoFromRole } from '@/features/alineaciones-v2/utils/legacyAccessLevel'
import { sessionOperationalTeamName } from '@/features/alineaciones-v2/utils/sessionTeam'

const ESTADO_PARTIDO_LABEL: Record<string, string> = {
  sin_alineacion: 'Sin alineación',
  alineacion_parcial: 'Alineación parcial',
  acta_abierta: 'Acta abierta',
  acta_cerrada: 'Acta cerrada',
  unspecified: '—',
}

interface CalendarMatchesTableProps {
  readonly matches: readonly CalendarMatchDto[]
  readonly calendarFilters: { readonly categoria: CalendarCategory; readonly fase: CalendarPhase }
}

export function CalendarMatchesTable({ matches, calendarFilters }: CalendarMatchesTableProps) {
  const { state } = useSession()
  const [modalMatch, setModalMatch] = useState<CalendarMatchDto | null>(null)

  const user = state.status === 'authenticated' ? state.user : null
  const staffish = user ? legacyNivelAccesoFromRole(user.role) >= 10 : false
  const teamName = user && user.role === 'team' ? sessionOperationalTeamName(user, calendarFilters.categoria) : null

  return (
    <>
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
              <th scope="col" className="px-3 py-3 sm:px-4">
                Alineación (partido)
              </th>
              <th scope="col" className="px-3 py-3 sm:px-4">
                Contexto equipo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {matches.map((m) => {
              const lineupsParams = new URLSearchParams({
                categoria: calendarFilters.categoria,
                fase: calendarFilters.fase,
                rk: calendarRecordKeyForDto(m),
              })
              const rk = calendarRecordKeyForDto(m)
              const inTeamRow =
                !!teamName &&
                (teamName === m.equipoLocal.trim() || teamName === m.equipoVisitante.trim())
              const ctxTeamQs =
                inTeamRow && teamName
                  ? buildTeamLineupContextSearchParams({
                      calendarFilters,
                      recordKey: rk,
                      equipoOperativo: teamName,
                      match: m,
                    })
                  : null

              return (
                <tr key={`${m.encuentroId}|${m.referenciaEncuentro}`} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">{m.grupo || '—'}</td>
                  <td className="px-3 py-2.5 sm:px-4">{m.equipoLocal}</td>
                  <td className="px-3 py-2.5 sm:px-4">{m.equipoVisitante}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">{m.hora || '—'}</td>
                  <td className="max-w-[10rem] truncate px-3 py-2.5 sm:max-w-xs sm:px-4">{m.campo || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">{m.resultadoDisplay || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4 sm:text-sm">
                    {ESTADO_PARTIDO_LABEL[m.estadoPartido] ?? m.estadoPartido}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                    <Link
                      to={`${ROUTES.calendarLineups}?${lineupsParams.toString()}`}
                      className="text-sm font-medium text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                    {staffish ? (
                      <button
                        type="button"
                        className="text-sm font-medium text-indigo-700 underline-offset-2 hover:text-indigo-900 hover:underline"
                        onClick={() => {
                          setModalMatch(m)
                        }}
                      >
                        Elegir equipo…
                      </button>
                    ) : inTeamRow && ctxTeamQs ? (
                      <Link
                        to={`${ROUTES.calendarTeamLineupContext}?${ctxTeamQs}`}
                        className="text-sm font-medium text-indigo-700 underline-offset-2 hover:text-indigo-900 hover:underline"
                      >
                        Mi contexto
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalMatch ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ctx-modal-title"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h2 id="ctx-modal-title" className="text-lg font-semibold text-slate-900">
              Contexto operativo
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Elija el equipo a diagnosticar para este encuentro ({modalMatch.equipoLocal} — {modalMatch.equipoVisitante}).
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-center text-sm font-medium text-slate-800 hover:bg-slate-100"
                to={`${ROUTES.calendarTeamLineupContext}?${buildTeamLineupContextSearchParams({
                  calendarFilters,
                  recordKey: calendarRecordKeyForDto(modalMatch),
                  equipoOperativo: modalMatch.equipoLocal,
                  match: modalMatch,
                })}`}
                onClick={() => {
                  setModalMatch(null)
                }}
              >
                Local: {modalMatch.equipoLocal}
              </Link>
              <Link
                className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-center text-sm font-medium text-slate-800 hover:bg-slate-100"
                to={`${ROUTES.calendarTeamLineupContext}?${buildTeamLineupContextSearchParams({
                  calendarFilters,
                  recordKey: calendarRecordKeyForDto(modalMatch),
                  equipoOperativo: modalMatch.equipoVisitante,
                  match: modalMatch,
                })}`}
                onClick={() => {
                  setModalMatch(null)
                }}
              >
                Visitante: {modalMatch.equipoVisitante}
              </Link>
              <button
                type="button"
                className="mt-2 rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  setModalMatch(null)
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
