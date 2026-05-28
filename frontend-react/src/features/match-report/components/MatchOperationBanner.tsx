import type { NormalizedOperationError, RecoveryHints } from '../types/matchReportOperation.types'
import type { OperationBannerVariant } from '../selectors/matchReportUiSelectors'
import { buildRecoveryUxCopy } from '../ux/uxOperationalMessages'
import { MatchStatusBadge } from './MatchStatusBadge'
import type { MatchReportOperationStatus } from '../types/matchReportOperation.types'

const BANNER_CLASS: Record<OperationBannerVariant, string> = {
  neutral: 'border-slate-200 bg-slate-50',
  busy: 'border-sky-200 bg-sky-50',
  success: 'border-emerald-200 bg-emerald-50',
  error: 'border-red-200 bg-red-50',
  warning: 'border-amber-200 bg-amber-50',
}

export interface MatchOperationBannerProps {
  readonly operation: MatchReportOperationStatus
  readonly operationLabel: string
  readonly variant: OperationBannerVariant
  readonly busy: boolean
  readonly operationError: NormalizedOperationError | null
  readonly recovery: RecoveryHints | null
  readonly canRetrySave: boolean
  readonly canRetryFinalize: boolean
  readonly canReload: boolean
  readonly onRetrySave?: () => void
  readonly onRetryFinalize?: () => void
  readonly onReload?: () => void
  readonly onDismissError?: () => void
}

export function MatchOperationBanner({
  operation,
  operationLabel,
  variant,
  busy,
  operationError,
  recovery,
  canRetrySave,
  canRetryFinalize,
  canReload,
  onRetrySave,
  onRetryFinalize,
  onReload,
  onDismissError,
}: MatchOperationBannerProps) {
  const showRecovery = operationError && (canRetrySave || canRetryFinalize || canReload)

  return (
    <section className={`rounded-lg border p-4 ${BANNER_CLASS[variant]}`} role="status" aria-live="polite">
      <div>
        <MatchStatusBadge operation={operation} label={operationLabel} variant={variant} />
        {busy ? (
          <p className="mt-2 text-sm text-slate-700" data-testid="match-operation-busy">
            Procesando operación en Drive…
          </p>
        ) : null}
      </div>

      {operationError ? (
        <div className="mt-3" data-testid="match-operation-error">
          <p className="text-sm font-medium text-red-900">{operationError.userMessage}</p>
          <p className="mt-0.5 text-xs text-red-800/80">
            {operationError.code} — {operationError.technicalMessage}
          </p>
          {operationError.code === 'DOCUMENT_VERSION_CONFLICT' ? (
            <p className="mt-2 text-xs font-medium text-amber-900">
              Otro operador guardó cambios. Use «Recargar» para sincronizar con Drive sin sobrescribir.
            </p>
          ) : null}
        </div>
      ) : null}

      {recovery?.preserveDirty && operationError ? (
        <p className="mt-2 text-xs text-amber-900">Los cambios locales se conservan hasta guardar o deshacer.</p>
      ) : null}

      {showRecovery ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canRetrySave && onRetrySave ? (
            <button
              type="button"
              disabled={busy}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              onClick={onRetrySave}
            >
              Reintentar guardar
            </button>
          ) : null}
          {canRetryFinalize && onRetryFinalize ? (
            <button
              type="button"
              disabled={busy}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              onClick={onRetryFinalize}
            >
              Reintentar cerrar
            </button>
          ) : null}
          {canReload && onReload ? (
            <button
              type="button"
              disabled={busy}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              onClick={onReload}
            >
              Recargar acta
            </button>
          ) : null}
          {onDismissError ? (
            <button
              type="button"
              className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-white/60"
              onClick={onDismissError}
            >
              Descartar aviso
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
