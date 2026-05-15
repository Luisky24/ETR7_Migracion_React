import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { hasCapability } from '@/contracts/capabilities.contract'
import { useSession } from '@/contexts/SessionContext'
import { ROUTES } from '@/router/routes'
import type { TeamLineupContextWire } from '../contracts/teamLineupContext.contract'
import { AlineacionHeader } from '../components/AlineacionHeader'
import type { TeamLineupDraftState } from '../components/TeamLineupContextPanel'
import { TeamLineupContextPanel } from '../components/TeamLineupContextPanel'
import { AlineacionConfirmPromptModal } from '../components/AlineacionConfirmPromptModal'
import {
  AlineacionConfirmResultModal,
  type AlineacionConfirmResultVariant,
} from '../components/AlineacionConfirmResultModal'
import { AlineacionUnsavedChangesModal } from '../components/AlineacionUnsavedChangesModal'
import { useTeamLineupContext } from '../hooks/useTeamLineupContext'
import { useLineupUnsavedGuard } from '../hooks/useLineupUnsavedGuard'
import { useLineupConfirmRedirect } from '../hooks/useLineupConfirmRedirect'
import { teamLineupContextService } from '../services/teamLineupContext.service'
import { computeLineupConfirmBlockingErrors } from '../utils/lineupConfirmValidation'
import { reconcileLineupDraftFromWire } from '../utils/lineupReconcile'
import { computeLineupRuntimeStateFromResponse } from '../utils/lineupRuntimeState'
import { computeLineupSoftWarnings } from '../utils/lineupSoftWarnings'
import { legacyNivelAccesoFromRole } from '../utils/legacyAccessLevel'
import { sessionOperationalTeamName } from '../utils/sessionTeam'
import {
  buildTeamLineupConfirmRequest,
  buildTeamLineupSaveRequest,
  teamLineupContextRequestFromSearchParams,
} from '../utils/teamLineupContextQuery'

export function TeamLineupContextPage() {
  const navigate = useNavigate()
  const { state } = useSession()
  const [searchParams] = useSearchParams()
  const [draft, setDraft] = useState<TeamLineupDraftState | null>(null)
  const [persistedSnapshot, setPersistedSnapshot] = useState<TeamLineupDraftState | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmPromptOpen, setConfirmPromptOpen] = useState(false)
  const [confirmResultOpen, setConfirmResultOpen] = useState(false)
  const [confirmResultVariant, setConfirmResultVariant] = useState<AlineacionConfirmResultVariant>('success')
  const [confirmResultMessage, setConfirmResultMessage] = useState('')

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

  const runtime = useMemo(() => {
    if (!data || !data.ok) return null
    return computeLineupRuntimeStateFromResponse(data)
  }, [data])

  const isLockedLineup = runtime?.ui.isLockedLineup ?? false

  const { showUnsavedModal, requestNavigation, continueEditing, leaveWithoutSaving } = useLineupUnsavedGuard({
    draft,
    persistedSnapshot,
    isLockedLineup,
  })

  const goToCalendar = useCallback(() => {
    navigate(ROUTES.calendar)
  }, [navigate])

  const { secondsLeft, redirectNow } = useLineupConfirmRedirect({
    active: confirmResultOpen && confirmResultVariant === 'success',
    onRedirect: goToCalendar,
  })

  const applyServerLineup = useCallback((wire: TeamLineupContextWire | null) => {
    const reconciled = reconcileLineupDraftFromWire(wire)
    if (reconciled) {
      setDraft(reconciled.draft)
      setPersistedSnapshot(reconciled.persistedSnapshot)
      setSaveError(null)
      return
    }
    if (wire && !wire.ok) {
      setDraft(null)
      setPersistedSnapshot(null)
    }
  }, [])

  useEffect(() => {
    applyServerLineup(data)
  }, [data, applyServerLineup])

  const reconcileLineupFromServer = useCallback(async () => {
    const wire = await refetch({ background: true })
    applyServerLineup(wire)
    return wire
  }, [refetch, applyServerLineup])

  const softWarnings = useMemo(() => (draft ? computeLineupSoftWarnings(draft.jugadores) : []), [draft])

  const confirmHardErrors = useMemo(
    () =>
      draft
        ? computeLineupConfirmBlockingErrors({
            delegado: draft.delegado,
            entrenador: draft.entrenador,
            jugadores: draft.jugadores,
          })
        : [],
    [draft],
  )

  const handleBackToCalendar = useCallback(() => {
    requestNavigation(goToCalendar)
  }, [goToCalendar, requestNavigation])

  const handleOpenConfirmPrompt = useCallback(() => {
    if (!draft || state.status !== 'authenticated' || isLockedLineup) return
    if (confirmHardErrors.length > 0 || confirmBusy) return
    setConfirmPromptOpen(true)
  }, [draft, state.status, isLockedLineup, confirmHardErrors.length, confirmBusy])

  const handleCancelConfirmPrompt = useCallback(() => {
    if (confirmBusy) return
    setConfirmPromptOpen(false)
  }, [confirmBusy])

  const handleExecuteConfirm = useCallback(async () => {
    if (!draft || state.status !== 'authenticated' || isLockedLineup) return
    if (confirmHardErrors.length > 0) return

    const confirmReq = buildTeamLineupConfirmRequest(
      searchParams,
      nivelAcceso,
      sesionEquipo,
      draft.delegado,
      draft.entrenador,
      draft.jugadores,
    )
    if (!confirmReq) {
      setConfirmPromptOpen(false)
      setConfirmResultVariant('error')
      setConfirmResultMessage('Parámetros incompletos para confirmar.')
      setConfirmResultOpen(true)
      return
    }

    setConfirmBusy(true)
    try {
      const res = await teamLineupContextService.confirm(confirmReq)
      if (!res) {
        setConfirmPromptOpen(false)
        setConfirmResultVariant('error')
        setConfirmResultMessage('Respuesta de confirmación no reconocida.')
        setConfirmResultOpen(true)
        return
      }
      if (res.ok === false) {
        setConfirmPromptOpen(false)
        setConfirmResultVariant('error')
        setConfirmResultMessage(`${res.error.code}: ${res.error.message}`)
        setConfirmResultOpen(true)
        return
      }
      setConfirmPromptOpen(false)
      await reconcileLineupFromServer()
      setConfirmResultVariant('success')
      setConfirmResultMessage('')
      setConfirmResultOpen(true)
    } catch (e) {
      setConfirmPromptOpen(false)
      setConfirmResultVariant('error')
      setConfirmResultMessage(e instanceof Error ? e.message : String(e))
      setConfirmResultOpen(true)
    } finally {
      setConfirmBusy(false)
    }
  }, [
    draft,
    state.status,
    isLockedLineup,
    confirmHardErrors.length,
    searchParams,
    nivelAcceso,
    sesionEquipo,
    reconcileLineupFromServer,
  ])

  const handleGoToCalendarFromResult = useCallback(() => {
    setConfirmResultOpen(false)
    redirectNow()
  }, [redirectNow])

  const handleContinueEditingAfterError = useCallback(() => {
    setConfirmResultOpen(false)
    setConfirmResultMessage('')
  }, [])

  const handleSave = useCallback(async () => {
    if (!draft || state.status !== 'authenticated' || isLockedLineup) return
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
      await reconcileLineupFromServer()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaveBusy(false)
    }
  }, [
    draft,
    searchParams,
    nivelAcceso,
    sesionEquipo,
    state.status,
    isLockedLineup,
    reconcileLineupFromServer,
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
  const equipoTitulo =
    searchParams.get('equipo')?.trim() || (data && data.ok ? data.context.equipoOperativo : '')

  const flowModalOpen = confirmPromptOpen || confirmResultOpen

  return (
    <>
      <AlineacionUnsavedChangesModal
        open={showUnsavedModal}
        onContinueEditing={continueEditing}
        onLeaveWithoutSaving={leaveWithoutSaving}
      />

      <AlineacionConfirmPromptModal
        open={confirmPromptOpen}
        confirmBusy={confirmBusy}
        onCancel={handleCancelConfirmPrompt}
        onConfirm={() => {
          void handleExecuteConfirm()
        }}
      />

      <AlineacionConfirmResultModal
        open={confirmResultOpen}
        variant={confirmResultVariant}
        errorMessage={confirmResultMessage}
        secondsLeft={secondsLeft}
        onGoToCalendar={handleGoToCalendarFromResult}
        onContinueEditing={handleContinueEditingAfterError}
      />

      <article className="page-card max-w-6xl">
        {data && data.ok && runtime ? (
          <AlineacionHeader
            equipo={equipoTitulo}
            badgeLabel={runtime.ui.badgeLabel}
            badgeTone={runtime.ui.badgeTone}
            onBackToCalendar={handleBackToCalendar}
          />
        ) : (
          <header className="border-b border-slate-200 pb-4">
            <h1 className="text-xl font-semibold text-slate-900">Alineación</h1>
          </header>
        )}

        <div className="mt-6 space-y-6">
          {showNoParams ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Faltan parámetros en la URL. Abra esta vista desde el calendario (enlace de contexto de equipo).
            </p>
          ) : null}

          {request && loading ? (
            <p className="text-center text-sm text-slate-600">Cargando alineación…</p>
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
          {data && data.ok && draft && runtime ? (
            <TeamLineupContextPanel
              data={data}
              draft={draft}
              runtime={runtime}
              onDraftChange={setDraft}
              softWarnings={softWarnings}
              onSave={runtime.canOfferSave && !flowModalOpen ? () => void handleSave() : undefined}
              saveBusy={saveBusy}
              saveError={saveError}
              confirmHardErrors={confirmHardErrors}
              onRequestConfirm={
                runtime.canOfferConfirm && !flowModalOpen ? handleOpenConfirmPrompt : undefined
              }
              confirmBusy={confirmBusy}
            />
          ) : null}
        </div>
      </article>
    </>
  )
}
