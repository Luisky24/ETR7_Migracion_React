import { AlineacionModalShell } from './AlineacionModalShell'
import { InlineSpinner } from './InlineSpinner'

export type AlineacionConfirmResultVariant = 'success' | 'error'

interface AlineacionConfirmResultModalProps {
  readonly open: boolean
  readonly variant: AlineacionConfirmResultVariant
  readonly errorMessage?: string
  readonly secondsLeft: number
  readonly onGoToCalendar: () => void
  readonly onContinueEditing: () => void
}

export function AlineacionConfirmResultModal({
  open,
  variant,
  errorMessage,
  secondsLeft,
  onGoToCalendar,
  onContinueEditing,
}: AlineacionConfirmResultModalProps) {
  const isSuccess = variant === 'success'

  return (
    <AlineacionModalShell
      open={open}
      titleId="confirm-lineup-result-title"
      descId="confirm-lineup-result-desc"
      tone={isSuccess ? 'success' : 'error'}
      title={isSuccess ? 'Alineación confirmada' : 'No se pudo confirmar la alineación'}
      description={
        isSuccess ? (
          'La alineación se ha confirmado correctamente.'
        ) : (
          <span className="text-red-800">{errorMessage?.trim() || 'Error desconocido.'}</span>
        )
      }
      children={
        isSuccess ? (
          <p
            className="mt-3 flex items-center gap-2 text-xs text-slate-500"
            role="status"
            aria-live="polite"
          >
            <InlineSpinner className="text-slate-400" />
            <span>
              Redirigiendo automáticamente en{' '}
              <span className="inline-block w-[1.25rem] text-center font-medium tabular-nums text-slate-700">
                {secondsLeft}
              </span>
              s…
            </span>
          </p>
        ) : undefined
      }
      footer={
        isSuccess ? (
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
              onClick={onGoToCalendar}
            >
              Ir al calendario
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={onContinueEditing}
            >
              Continuar editando
            </button>
          </div>
        )
      }
    />
  )
}
