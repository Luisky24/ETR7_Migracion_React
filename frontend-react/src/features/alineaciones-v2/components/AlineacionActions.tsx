import { InlineSpinner } from './InlineSpinner'

interface AlineacionActionsProps {
  readonly isLockedLineup: boolean
  readonly canSave: boolean
  readonly canConfirm: boolean
  readonly saveBusy?: boolean
  readonly confirmBusy?: boolean
  readonly confirmHardErrors: readonly string[]
  readonly onSave?: () => void
  readonly onRequestConfirm?: () => void
}

export function AlineacionActions({
  isLockedLineup,
  canSave,
  canConfirm,
  saveBusy,
  confirmBusy,
  confirmHardErrors,
  onSave,
  onRequestConfirm,
}: AlineacionActionsProps) {
  const operationBusy = !!saveBusy || !!confirmBusy
  const confirmDisabled =
    isLockedLineup || confirmHardErrors.length > 0 || operationBusy
  const saveDisabled = isLockedLineup || operationBusy

  if (!canSave && !canConfirm) {
    return null
  }

  return (
    <section
      className="sticky top-0 z-20 shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
      aria-label="Acciones de alineación"
    >
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        {canSave && onSave ? (
          <button
            type="button"
            className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saveDisabled}
            onClick={onSave}
            aria-busy={saveBusy || undefined}
          >
            {saveBusy ? (
              <>
                <InlineSpinner />
                <span>Guardando…</span>
              </>
            ) : (
              'Guardar'
            )}
          </button>
        ) : null}
        {canConfirm && onRequestConfirm ? (
          <button
            type="button"
            className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={confirmDisabled}
            onClick={onRequestConfirm}
            aria-busy={confirmBusy || undefined}
            title={
              confirmHardErrors.length > 0
                ? 'Corrija los errores de validación antes de confirmar'
                : undefined
            }
          >
            {confirmBusy ? (
              <>
                <InlineSpinner />
                <span>Confirmando…</span>
              </>
            ) : (
              'Confirmar'
            )}
          </button>
        ) : null}
      </div>
    </section>
  )
}
