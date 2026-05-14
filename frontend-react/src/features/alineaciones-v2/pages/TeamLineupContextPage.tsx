import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { hasCapability } from '@/contracts/capabilities.contract'
import { useSession } from '@/contexts/SessionContext'
import { ROUTES } from '@/router/routes'
import type { TeamLineupDraftState } from '../components/TeamLineupContextPanel'
import { TeamLineupContextPanel } from '../components/TeamLineupContextPanel'
import { useTeamLineupContext } from '../hooks/useTeamLineupContext'
import { teamLineupContextService } from '../services/teamLineupContext.service'
import { computeLineupSoftWarnings } from '../utils/lineupSoftWarnings'
import { legacyNivelAccesoFromRole } from '../utils/legacyAccessLevel'
import { sessionOperationalTeamName } from '../utils/sessionTeam'
import { buildTeamLineupConfirmRequest, buildTeamLineupSaveRequest, teamLineupContextRequestFromSearchParams } from '../utils/teamLineupContextQuery'
import { computeLineupConfirmBlockingErrors } from '../utils/lineupConfirmValidation'

function cloneDraftFromContext(ctx: {
  delegado: string
  entrenador: string
  jugadores: readonly { nombre: string; titular: boolean; suplente: boolean; capitan: boolean; dorsal: number | null }[]
}): TeamLineupDraftState {
  return {
    delegado: ctx.delegado,
    entrenador: ctx.entrenador,
    jugadores: ctx.jugadores.map((j) => ({
      nombre: j.nombre,
      titular: j.titular,
      suplente: j.suplente,
      capitan: j.capitan,
      dorsal: j.dorsal,
    })),
  }
}

export function TeamLineupContextPage() {
  const { state } = useSession()
  const [searchParams] = useSearchParams()
  const [draft, setDraft] = useState<TeamLineupDraftState | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmAck, setConfirmAck] = useState(false)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const nivelAcceso = useMemo(() => {
    if (state.status !== 'authenticated') return 0
    return legacyNivelAccesoFromRole(state.user.role)
  }, [state])

  const sesionEquipo = useMemo(() => {
    if (state.status !== 'authenticated' || state.user.role !== 'team') return undefined
    const cat = searchParams.get('categoria')
    if (cat !== 'M' && cat !== 'F') return undefined
    return sessionOperationalTeamName(state.user, cat) ?? undefined
  }, [state, searchParams])

  const request = useMemo(
    () => teamLineupContextRequestFromSearchParams(searchParams, nivelAcceso, sesionEquipo),
    [searchParams, nivelAcceso, sesionEquipo],
  )

  const { data, loading, error, refetch } = useTeamLineupContext(request)

  useEffect(() => {
    if (data && data.ok) {
      setDraft(cloneDraftFromContext(data.context))
      setSaveError(null)
      setConfirmError(null)
      setConfirmAck(false)
    } else {
      setDraft(null)
      setConfirmAck(false)
    }
  }, [data])

  const softWarnings = useMemo(() => (draft ? computeLineupSoftWarnings(draft.jugadores) : []), [draft])

  const confirmHardErrors = useMemo(
    () => (draft ? computeLineupConfirmBlockingErrors(draft.jugadores) : []),
    [draft],
  )

  const handleSave = useCallback(async () => {
    if (!draft || state.status !== 'authenticated') return
    const saveReq = buildTeamLineupSaveRequest(
      searchParams,
      nivelAcceso,
      sesionEquipo,
      draft.delegado,
      draft.entrenador,
      draft.jugadores,
    )
    if (!saveReq) {
      setSaveError('Parámetros incompletos para guardar.')
      return
    }
    setSaveBusy(true)
    setSaveError(null)
    try {
      const res = await teamLineupContextService.save(saveReq)
      if (!res) {
        setSaveError('Respuesta de guardado no reconocida.')
        return
      }
      if (res.ok === false) {
        setSaveError(`${res.error.code}: ${res.error.message}`)
        return
      }
      await refetch()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaveBusy(false)
    }
  }, [draft, searchParams, nivelAcceso, sesionEquipo, state.status, refetch])

  const handleConfirm = useCallback(async () => {
    if (!draft || state.status !== 'authenticated') return
    if (confirmHardErrors.length > 0) return
    if (
      !window.confirm(
        '¿Confirma la alineación de forma definitiva? Quedará bloqueada para edición (calendario C) según las reglas de competición.',
      )
    ) {
      return
    }
    const confirmReq = buildTeamLineupConfirmRequest(
      searchParams,
      nivelAcceso,
      sesionEquipo,
      draft.delegado,
      draft.entrenador,
      draft.jugadores,
    )
    if (!confirmReq) {
      setConfirmError('Parámetros incompletos para confirmar.')
      return
    }
    setConfirmBusy(true)
    setConfirmError(null)
    try {
      const res = await teamLineupContextService.confirm(confirmReq)
      if (!res) {
        setConfirmError('Respuesta de confirmación no reconocida.')
        return
      }
      if (res.ok === false) {
        setConfirmError(`${res.error.code}: ${res.error.message}`)
        return
      }
      setConfirmAck(false)
      await refetch()
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : String(e))
    } finally {
      setConfirmBusy(false)
    }
  }, [
    draft,
    state.status,
    confirmHardErrors.length,
    searchParams,
    nivelAcceso,
    sesionEquipo,
    refetch,
  ])

  if (state.status !== 'authenticated') {
    return null
  }

  if (!hasCapability(state.user.capabilities, 'canAccessCalendar')) {
    return <Navigate to={ROUTES.menu} replace />
  }

  const showNoParams = request === null
  const showInvalid = !loading && !error && data === null && request !== null
  const errBody = data && data.ok === false ? data : null

  return (
    <article className="page-card max-w-6xl">
      <header className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Alineación por equipo</h1>
          <p className="mt-1 text-sm text-slate-600">
            Contexto <code className="rounded bg-slate-100 px-1">alineaciones_getTeamLineupContext_v2</code> · Guardado{' '}
            <code className="rounded bg-slate-100 px-1">alineaciones_saveTeamLineup_v2</code> · Confirmación{' '}
            <code className="rounded bg-slate-100 px-1">alineaciones_confirmTeamLineup_v2</code> (acta/calendario vía
            legacy).
          </p>
        </div>
        <Link
          to={ROUTES.calendar}
          className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          Volver al calendario
        </Link>
      </header>

      <div className="mt-6 space-y-6">
        {showNoParams ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Faltan parámetros en la URL (<code className="rounded bg-white px-1">categoria</code>,{' '}
            <code className="rounded bg-white px-1">fase</code>, <code className="rounded bg-white px-1">rk</code>,{' '}
            <code className="rounded bg-white px-1">equipo</code>). Abra desde el calendario.
          </p>
        ) : null}

        {request && loading ? (
          <p className="text-center text-sm text-slate-600">Cargando contexto…</p>
        ) : null}
        {request && !loading && error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error.message}
            <button
              type="button"
              className="ml-3 font-medium underline"
              onClick={() => {
                void refetch()
              }}
            >
              Reintentar
            </button>
          </div>
        ) : null}
        {request && !loading && !error && showInvalid ? (
          <p className="text-sm text-slate-600">Respuesta del servidor no reconocida.</p>
        ) : null}
        {errBody ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <strong>{errBody.error.code}</strong>: {errBody.error.message}
          </div>
        ) : null}
        {data && data.ok && draft ? (
          <TeamLineupContextPanel
            data={data}
            draft={draft}
            onDraftChange={setDraft}
            softWarnings={softWarnings}
            onSave={data.permissions.canEdit ? () => void handleSave() : undefined}
            saveBusy={saveBusy}
            saveError={saveError}
            confirmHardErrors={confirmHardErrors}
            canConfirm={data.permissions.canConfirm}
            confirmAck={confirmAck}
            onConfirmAckChange={setConfirmAck}
            onConfirm={data.permissions.canConfirm ? () => void handleConfirm() : undefined}
            confirmBusy={confirmBusy}
            confirmError={confirmError}
          />
        ) : null}
      </div>
    </article>
  )
}
