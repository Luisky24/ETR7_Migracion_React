import { useEffect, useRef } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { hasCapability } from '@/contracts/capabilities.contract'
import { useSession } from '@/contexts/SessionContext'
import { ROUTES } from '@/router/routes'
import { canOpenMatchReport } from '../domain'
import { MatchReportProvider } from '../context/MatchReportProvider'
import { useMatchReport } from '../hooks/useMatchReport'
import {
  matchContextLoadKey,
  useStableMatchContextFromSearch,
} from '../hooks/useStableMatchContextFromSearch'
import { MatchReportView } from '../components/MatchReportView'
import { prepareDocumentRuntimeForEncounter } from '../domain/documentRuntimeNavigation'

function MatchReportPageInner() {
  const [searchParams] = useSearchParams()
  const context = useStableMatchContextFromSearch(searchParams)
  const { load } = useMatchReport()
  const hydratedLoadKeyRef = useRef<string | null>(null)
  const previousEncounterIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!context || !canOpenMatchReport(context)) {
      hydratedLoadKeyRef.current = null
      previousEncounterIdRef.current = null
      return
    }
    const loadKey = matchContextLoadKey(context)
    if (hydratedLoadKeyRef.current === loadKey) {
      return
    }
    prepareDocumentRuntimeForEncounter(context.encuentroId, previousEncounterIdRef.current)
    previousEncounterIdRef.current = context.encuentroId
    hydratedLoadKeyRef.current = loadKey
    void load(context)
  }, [context, load])

  if (!context) {
    return (
      <article className="space-y-4 p-4">
        <p className="text-sm text-slate-700">
          Parámetros de acta incompletos (categoria, fase, rk/encuentroId).
        </p>
        <Link to={ROUTES.calendar} className="text-sm font-medium text-sky-700 hover:underline">
          Volver al calendario
        </Link>
      </article>
    )
  }

  if (!canOpenMatchReport(context)) {
    return (
      <article className="space-y-4 p-4">
        <p className="text-sm text-slate-700">
          El encuentro no está en estado de acta abierta o cerrada ({context.matchStatus}).
        </p>
        <Link to={ROUTES.calendar} className="text-sm font-medium text-sky-700 hover:underline">
          Volver al calendario
        </Link>
      </article>
    )
  }

  return <MatchReportView />
}

export function MatchReportPage() {
  const { state } = useSession()

  if (state.status !== 'authenticated') {
    return null
  }

  if (!hasCapability(state.user.capabilities, 'canAccessCalendar')) {
    return <Navigate to={ROUTES.menu} replace />
  }

  return (
    <article className="mx-auto max-w-5xl p-4 md:p-6">
      <MatchReportProvider>
        <MatchReportPageInner />
      </MatchReportProvider>
    </article>
  )
}
