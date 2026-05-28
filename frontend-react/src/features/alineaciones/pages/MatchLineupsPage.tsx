import React, { useMemo } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { hasCapability } from '@/contracts/capabilities.contract'
import { useSession } from '@/contexts/SessionContext'
import type { CalendarCategory, CalendarPhase } from '@/features/calendar/contracts/calendar.contract'
import { ROUTES } from '@/router/routes'
import { LineupsEmptyState } from '../components/LineupsEmptyState'
import { LineupsErrorState } from '../components/LineupsErrorState'
import { LineupsLoadingState } from '../components/LineupsLoadingState'
import type { MatchLineupsQuery } from '../contracts/alineaciones.contract'
import { useCalendarMatchByRecordKey } from '@/features/calendar/hooks/useCalendarMatchByRecordKey'
import { useEncounterWorkspace } from '@/features/match-report/hooks/useEncounterWorkspace'
import type { MatchContext } from '@/features/match-report/contracts'
import {
  selectLineupIsSuperseded,
  selectLineupStaleState,
  selectLineupTeamViews,
  type LineupTeamView,
} from '@/features/match-report/selectors/lineupDocumentSelectors'
import { MatchStaleDocumentBanner } from '@/features/match-report/components/MatchStaleDocumentBanner'
import { MatchSupersededBanner } from '@/features/match-report/components/MatchSupersededBanner'

function parseCategory(raw: string | null): CalendarCategory | null {
  if (raw === 'M' || raw === 'F') return raw
  return null
}

function parsePhase(raw: string | null): CalendarPhase | null {
  if (raw === 'Fase I' || raw === 'Fase II') return raw
  return null
}

function TeamBlock({ title, team }: { readonly title: string; readonly team: LineupTeamView }) {
  const staff =
    team.entrenador || team.delegado ? (
      <ul className="mt-2 list-none space-y-1 text-xs text-slate-600">
        {team.entrenador ? (
          <li>
            <span className="font-medium text-slate-700">Entrenador:</span> {team.entrenador}
          </li>
        ) : null}
        {team.delegado ? (
          <li>
            <span className="font-medium text-slate-700">Delegado:</span> {team.delegado}
          </li>
        ) : null}
      </ul>
    ) : null

  const refMeta = team.projection?.storageKey ? (
    <p className="mt-1 text-xs text-slate-500">
      Ref: v{team.projection.documentVersion ?? '—'} / rev {team.projection.closeRevision ?? '—'} (
      {team.projection.lifecycle ?? '—'})
    </p>
  ) : null

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-700">{team.teamName || '—'}</p>
      {refMeta}
      {staff}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Dorsal</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Titular</th>
              <th className="px-3 py-2">Capitán</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {team.jugadores.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-sm text-slate-500">
                  Sin jugadores en alineación.
                </td>
              </tr>
            ) : (
              team.jugadores.map((j) => (
                <tr key={`${j.dorsal}-${j.nombre}`}>
                  <td className="whitespace-nowrap px-3 py-2">{j.dorsal || '—'}</td>
                  <td className="px-3 py-2">{j.nombre}</td>
                  <td className="px-3 py-2">{j.titular ? 'Sí' : 'No'}</td>
                  <td className="px-3 py-2">{j.capitan ? 'Sí' : 'No'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function MatchLineupsPage() {
  const { state } = useSession()
  const [searchParams] = useSearchParams()

  const query: MatchLineupsQuery | null = useMemo(() => {
    const categoria = parseCategory(searchParams.get('categoria'))
    const fase = parsePhase(searchParams.get('fase'))
    const recordKey = searchParams.get('rk')?.trim() ?? ''
    if (!categoria || !fase || !recordKey) return null
    return { categoria, fase, recordKey }
  }, [searchParams])

  const { match, loading: matchLoading, error: matchError, refetch: refetchMatch } =
    useCalendarMatchByRecordKey(
      query ? { categoria: query.categoria, fase: query.fase, recordKey: query.recordKey } : null,
    )

  const encounterId = match?.encuentroId ?? null
  const { document, loading: wsLoading, error: wsError, load: loadWorkspace, reload } =
    useEncounterWorkspace(encounterId)

  const loading = matchLoading || wsLoading
  const error = matchError ?? wsError

  React.useEffect(() => {
    if (!query || !match) return
    const context: MatchContext = {
      category: query.categoria,
      phase: query.fase,
      encuentroId: match.encuentroId,
      grupo: match.grupo,
      equipoLocal: match.equipoLocal,
      equipoVisitante: match.equipoVisitante,
      hora: match.hora,
      campo: match.campo,
      resultadoDisplay: match.resultadoDisplay,
      estadoAlineacionesDisplay: match.estadoAlineacionesDisplay,
      matchStatus: match.estadoPartido,
      referenciaEncuentro: match.referenciaEncuentro,
    }
    void loadWorkspace(context)
  }, [query, match, loadWorkspace])

  const teamViews = useMemo(
    () => (encounterId ? selectLineupTeamViews(encounterId) : null),
    [encounterId, document],
  )
  const isSuperseded = useMemo(
    () => (encounterId ? selectLineupIsSuperseded(encounterId) : false),
    [encounterId, document],
  )
  const staleState = useMemo(
    () => (encounterId ? selectLineupStaleState(encounterId) : null),
    [encounterId, document],
  )

  if (state.status !== 'authenticated') {
    return null
  }

  if (!hasCapability(state.user.capabilities, 'canAccessCalendar')) {
    return <Navigate to={ROUTES.menu} replace />
  }

  const backHref = ROUTES.calendar
  const showNoParams = query === null
  const showBoundaryInvalid = !loading && !error && !document && query !== null

  return (
    <article className="page-card max-w-6xl">
      <header className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Alineaciones</h1>
          <p className="mt-1 text-sm text-slate-600">
            Solo lectura. Proyección documental unificada (Encounter Workspace + snapshots CLOSED).
          </p>
        </div>
        <Link
          to={backHref}
          className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          Volver al calendario
        </Link>
      </header>

      <div className="mt-6 space-y-6">
        {showNoParams ? (
          <LineupsEmptyState message="Falta información del encuentro. Abra esta vista desde el calendario (enlace «Alineación»)." />
        ) : null}

        {query && loading ? <LineupsLoadingState /> : null}
        {query && !loading && error ? (
          <LineupsErrorState message={error.message} onRetry={() => void refetchMatch()} />
        ) : null}
        {query && !loading && !error && showBoundaryInvalid ? (
          <LineupsEmptyState message="Respuesta del servidor no reconocida. Reintente o revise el despliegue del boundary." />
        ) : null}

        <MatchStaleDocumentBanner
          stale={staleState}
          onReload={
            match && query
              ? () => {
                  const context: MatchContext = {
                    category: query.categoria,
                    phase: query.fase,
                    encuentroId: match.encuentroId,
                    grupo: match.grupo,
                    equipoLocal: match.equipoLocal,
                    equipoVisitante: match.equipoVisitante,
                    hora: match.hora,
                    campo: match.campo,
                    resultadoDisplay: match.resultadoDisplay,
                    estadoAlineacionesDisplay: match.estadoAlineacionesDisplay,
                    matchStatus: match.estadoPartido,
                    referenciaEncuentro: match.referenciaEncuentro,
                  }
                  void reload(context)
                }
              : undefined
          }
        />

        <MatchSupersededBanner
          open={isSuperseded}
          onReload={
            match && query
              ? () => {
                  const context: MatchContext = {
                    category: query.categoria,
                    phase: query.fase,
                    encuentroId: match.encuentroId,
                    grupo: match.grupo,
                    equipoLocal: match.equipoLocal,
                    equipoVisitante: match.equipoVisitante,
                    hora: match.hora,
                    campo: match.campo,
                    resultadoDisplay: match.resultadoDisplay,
                    estadoAlineacionesDisplay: match.estadoAlineacionesDisplay,
                    matchStatus: match.estadoPartido,
                    referenciaEncuentro: match.referenciaEncuentro,
                  }
                  void reload(context)
                }
              : undefined
          }
        />

        {teamViews ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <TeamBlock title="Local" team={teamViews.local} />
            <TeamBlock title="Visitante" team={teamViews.visitante} />
          </div>
        ) : null}
      </div>
    </article>
  )
}
