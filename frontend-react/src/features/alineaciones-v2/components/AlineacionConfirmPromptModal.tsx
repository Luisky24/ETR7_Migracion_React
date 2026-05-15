import { AlineacionModalShell } from './AlineacionModalShell'
import { InlineSpinner } from './InlineSpinner'

interface AlineacionConfirmPromptModalProps {
  readonly open: boolean
  readonly confirmBusy: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

export function AlineacionConfirmPromptModal({
  open,
  confirmBusy,
  onCancel,
  onConfirm,
}: AlineacionConfirmPromptModalProps) {
  return (
    <AlineacionModalShell
      open={open}
      titleId="confirm-lineup-prompt-title"
      descId="confirm-lineup-prompt-desc"
      title="Confirmar alineación"
      description={
        <>
          La alineación quedará confirmada y bloqueada para edición.
          <br />
          ¿Deseas continuar?
        </>
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={confirmBusy}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex min-w-[11rem] items-center justify-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={confirmBusy}
            onClick={onConfirm}
          >
            {confirmBusy ? (
              <>
                <InlineSpinner />
                <span>Confirmando…</span>
              </>
            ) : (
              'Confirmar alineación'
            )}
          </button>
        </div>
      }
    />
  )
}
