import { useCallback, useMemo, useState } from 'react'
import { useMatchReportEntryFocus, scheduleRestoreActionFocus } from '../hooks/useMatchReportEntryFocus'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/router/routes'
import { useMatchReport } from '../hooks/useMatchReport'
import { useMatchReportForm } from '../hooks/useMatchReportForm'
import { useMatchReportMeta } from '../hooks/useMatchReportMeta'
import {
  selectClassificationRows,
  selectMatchReportHeaderView,
  selectOperationBannerVariant,
} from '../selectors/matchReportUiSelectors'
import {
  selectCloseBlockingErrors,
  selectDraftBlockingErrors,
  selectCanAttemptFinalize,
  selectCanAttemptSave,
  selectHelpHasActiveNotices,
  selectMatchHelpContent,
  selectShowOperationBanner,
} from '../selectors/matchReportValidationUxSelectors'
import {
  selectIsDirty,
  selectIsLoading,
  selectIsReadOnly,
  selectMatchReport,
  selectMatchResult,
  selectMatchScore,
} from '../selectors/matchReportSelectors'
import {
  selectCanReloadReport,
  selectCanRetryFinalize,
  selectCanRetrySave,
  selectIsOperationBusy,
  selectOperation,
  selectOperationLabel,
} from '../selectors/matchReportOperationSelectors'
import {
  selectEffectiveReadOnly,
  selectIsSuperseded,
  selectRuntimeStaleState,
  selectShowRecoveryBanner,
} from '../selectors/matchReportDocumentSelectors'
import { MatchStaleDocumentBanner } from './MatchStaleDocumentBanner'
import { useUxOperationalTelemetry } from '../hooks/useUxOperationalTelemetry'
import { needsEmptyCloseConfirmation } from '../domain'
import { MatchActionsTable } from './MatchActionsTable'
import { MatchCloseBlockedModal } from './MatchCloseBlockedModal'
import { MatchClosurePanel } from './MatchClosurePanel'
import { MatchDirtyStateIndicator } from './MatchDirtyStateIndicator'
import { MatchFinalizeConfirmModal } from './MatchFinalizeConfirmModal'
import { MatchHelpPanel } from './MatchHelpPanel'
import { MatchOperationBanner } from './MatchOperationBanner'
import { MatchSaveBlockedModal } from './MatchSaveBlockedModal'
import { MatchReportMetaPanel } from './MatchReportMetaPanel'
import { MatchScoreCard } from './MatchScoreCard'
import { MatchTeamCard } from './MatchTeamCard'
import { MatchTeamObservationsField } from './MatchTeamObservationsField'
import { MatchSupersededBanner } from './MatchSupersededBanner'

export function MatchReportView() {
  const { state, saveDraft, finalizeReport, recalculate, reset, reload, dismissError } =
    useMatchReport()
  const form = useMatchReportForm()
  const meta = useMatchReportMeta()

  const report = selectMatchReport(state)
  const header = useMemo(() => selectMatchReportHeaderView(state), [state])
  const score = useMemo(() => selectMatchScore(state), [state])
  const matchResult = useMemo(() => selectMatchResult(state), [state])
  const helpContent = useMemo(() => selectMatchHelpContent(state), [state])
  const helpHasNotices = useMemo(() => selectHelpHasActiveNotices(state), [state])
  const classificationRows = useMemo(() => selectClassificationRows(state), [state])
  const operation = useMemo(() => selectOperation(state), [state.operation, state.operationError])
  const operationLabel = useMemo(() => selectOperationLabel(state), [state.operation])
  const bannerVariant = useMemo(() => selectOperationBannerVariant(state), [state])
  const runtimeStale = useMemo(() => selectRuntimeStaleState(state), [state])
  const showStaleBanner = runtimeStale?.isStale === true
  const showRecoveryBanner = useMemo(() => selectShowRecoveryBanner(state), [state])
  const showOperationBanner = useMemo(
    () => selectShowOperationBanner(state) || showStaleBanner || showRecoveryBanner,
    [state, showStaleBanner, showRecoveryBanner],
  )
  const operationError = state.operationError
  const recovery = state.recovery
  const canRetrySave = useMemo(() => selectCanRetrySave(state), [state.operation, state.recovery])
  const canRetryFinalize = useMemo(() => selectCanRetryFinalize(state), [state.operation, state.recovery])
  const canReload = useMemo(() => selectCanReloadReport(state), [state.recovery, state.context])
  const isDirty = useMemo(() => selectIsDirty(state), [state.dirty])
  const canAttemptSave = useMemo(() => selectCanAttemptSave(state), [state])
  const canAttemptFinalize = useMemo(() => selectCanAttemptFinalize(state), [state])
  const busy = useMemo(() => selectIsOperationBusy(state), [state.operation])
  const baseReadOnly = useMemo(() => selectIsReadOnly(state), [state])
  const readOnly = useMemo(() => selectEffectiveReadOnly(state, baseReadOnly), [state, baseReadOnly])
  const isSuperseded = useMemo(() => selectIsSuperseded(state), [state.document, state])
  const isConcurrentConflict = state.operationError?.code === 'DOCUMENT_VERSION_CONFLICT'
  useUxOperationalTelemetry(state)
  const [helpOpen, setHelpOpen] = useState(false)
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false)
  const [closeBlockedOpen, setCloseBlockedOpen] = useState(false)
  const [saveBlockedOpen, setSaveBlockedOpen] = useState(false)

  const closeBlockingErrors = useMemo(() => selectCloseBlockingErrors(state), [state])
  const draftBlockingErrors = useMemo(() => selectDraftBlockingErrors(state), [state])

  const needsEmptyCloseConfirm = useMemo(
    () => (report ? needsEmptyCloseConfirmation(report) : false),
    [report],
  )

  const runFinalize = useCallback(
    (confirmEmptyClose: boolean) => {
      void finalizeReport(undefined, undefined, { confirmEmptyClose })
    },
    [finalizeReport],
  )

  const onFinalize = useCallback(() => {
    if (closeBlockingErrors.length > 0) {
      setCloseBlockedOpen(true)
      return
    }
    setFinalizeConfirmOpen(true)
  }, [closeBlockingErrors])

  const onConfirmFinalize = useCallback(() => {
    setFinalizeConfirmOpen(false)
    runFinalize(needsEmptyCloseConfirm)
    scheduleRestoreActionFocus()
  }, [needsEmptyCloseConfirm, runFinalize])

  const onCancelFinalize = useCallback(() => {
    setFinalizeConfirmOpen(false)
    scheduleRestoreActionFocus()
  }, [])

  const dismissCloseBlocked = useCallback(() => {
    setCloseBlockedOpen(false)
    scheduleRestoreActionFocus()
  }, [])

  const dismissSaveBlocked = useCallback(() => {
    setSaveBlockedOpen(false)
    scheduleRestoreActionFocus()
  }, [])

  const closeHelp = useCallback(() => {
    setHelpOpen(false)
    scheduleRestoreActionFocus()
  }, [])

  useMatchReportEntryFocus({
    operation,
    canEdit: form.canEdit,
    readOnly,
    reportReady: !!report,
  })

  const onSave = useCallback(() => {
    if (draftBlockingErrors.length > 0) {
      setSaveBlockedOpen(true)
      return
    }
    void saveDraft()
  }, [draftBlockingErrors, saveDraft])

  const onReload = useCallback(() => {
    void reload()
  }, [reload])

  if (selectIsLoading(state)) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" role="status">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
          aria-hidden
        />
        <p className="text-sm text-slate-600">Cargando acta del encuentro…</p>
      </div>
    )
  }

  if (!report || !header || !score || !matchResult) {
    const err = state.operationError?.userMessage ?? state.error
    return (
      <div className="space-y-4">
        {err ? (
          <p className="text-sm text-red-800">{err}</p>
        ) : (
          <p className="text-sm text-slate-600">Sin datos de acta.</p>
        )}
        <Link
          to={ROUTES.calendar}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          ← Volver al calendario
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            to={ROUTES.calendar}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            ← Volver al calendario
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="relative rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
              aria-haspopup="dialog"
              aria-expanded={helpOpen}
              onClick={() => setHelpOpen(true)}
            >
              Ayuda
              {helpHasNotices ? (
                <span
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white"
                  aria-label="Hay avisos informativos"
                />
              ) : null}
            </button>
            <MatchDirtyStateIndicator dirtyCount={form.dirtyCount} isDirty={isDirty} />
          </div>
        </div>
      </div>

      {showOperationBanner ? (
        <MatchOperationBanner
          operation={operation}
          operationLabel={operationLabel}
          variant={bannerVariant}
          busy={busy}
          operationError={operationError}
          recovery={recovery}
          canRetrySave={canRetrySave}
          canRetryFinalize={canRetryFinalize}
          canReload={canReload}
          onRetrySave={onSave}
          onRetryFinalize={onFinalize}
          onReload={onReload}
          onDismissError={dismissError}
        />
      ) : null}

      <MatchStaleDocumentBanner
        stale={runtimeStale}
        concurrent={isConcurrentConflict}
        onReload={canReload ? onReload : undefined}
      />

      <MatchSupersededBanner open={isSuperseded} onReload={onReload} />

      <MatchScoreCard
        score={score}
        result={matchResult}
        headerTitle={header.title}
        headerSubtitle={header.subtitle}
        classificationRows={classificationRows}
      />

      <MatchReportMetaPanel
        refereeName={meta.refereeName}
        incidencias={meta.incidencias}
        readOnly={readOnly}
        isRefereeDirty={meta.isRefereeDirty}
        isIncidenciasDirty={meta.isIncidenciasDirty}
        onRefereeChange={meta.onRefereeChange}
        onIncidenciasChange={meta.onIncidenciasChange}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <MatchTeamCard team={report.local} readOnly={readOnly}>
          <MatchActionsTable
            side="local"
            team={report.local}
            canEdit={form.canEdit}
            isFieldDirty={form.isFieldDirty}
            getFieldError={form.getFieldError}
            onActionChange={form.handleActionInputChange}
          />
          <MatchTeamObservationsField
            side="local"
            teamName={report.local.equipo}
            value={meta.localObservaciones}
            readOnly={readOnly}
            dirty={meta.isTeamObservationsDirty('local')}
            onChange={(value) => meta.onTeamObservationsChange('local', value)}
          />
        </MatchTeamCard>
        <MatchTeamCard team={report.visitante} readOnly={readOnly}>
          <MatchActionsTable
            side="visitante"
            team={report.visitante}
            canEdit={form.canEdit}
            isFieldDirty={form.isFieldDirty}
            getFieldError={form.getFieldError}
            onActionChange={form.handleActionInputChange}
          />
          <MatchTeamObservationsField
            side="visitante"
            teamName={report.visitante.equipo}
            value={meta.visitObservaciones}
            readOnly={readOnly}
            dirty={meta.isTeamObservationsDirty('visitante')}
            onChange={(value) => meta.onTeamObservationsChange('visitante', value)}
          />
        </MatchTeamCard>
      </div>

      <MatchClosurePanel
        canSave={canAttemptSave}
        canFinalize={canAttemptFinalize}
        busy={busy}
        isReadOnly={readOnly}
        onSave={onSave}
        onFinalize={onFinalize}
        onRecalculate={recalculate}
        onReset={reset}
      />

      <MatchHelpPanel open={helpOpen} content={helpContent} onClose={closeHelp} />
      <MatchFinalizeConfirmModal
        open={finalizeConfirmOpen}
        busy={busy}
        score={score}
        result={matchResult}
        matchStatus={report.context.matchStatus}
        teamLocalName={report.context.equipoLocal}
        teamVisitName={report.context.equipoVisitante}
        variant={needsEmptyCloseConfirm ? 'empty_close' : 'normal'}
        onCancel={onCancelFinalize}
        onConfirm={onConfirmFinalize}
      />
      <MatchCloseBlockedModal
        open={closeBlockedOpen}
        issues={closeBlockingErrors}
        onDismiss={dismissCloseBlocked}
      />
      <MatchSaveBlockedModal
        open={saveBlockedOpen}
        issues={draftBlockingErrors}
        onDismiss={dismissSaveBlocked}
      />
    </div>
  )
}
