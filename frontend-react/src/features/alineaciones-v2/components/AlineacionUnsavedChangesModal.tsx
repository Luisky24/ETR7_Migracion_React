import { AlineacionModalShell } from './AlineacionModalShell'

interface AlineacionUnsavedChangesModalProps {
  readonly open: boolean
  readonly onContinueEditing: () => void
  readonly onLeaveWithoutSaving: () => void
}

export function AlineacionUnsavedChangesModal({
  open,
  onContinueEditing,
  onLeaveWithoutSaving,
}: AlineacionUnsavedChangesModalProps) {
  return (
    <AlineacionModalShell
      open={open}
      titleId="unsaved-lineup-title"
      descId="unsaved-lineup-desc"
      title="Cambios sin guardar"
      description="Hay cambios sin guardar en la alineación. Si sales ahora, se perderán."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onContinueEditing}
          >
            Continuar editando
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            onClick={onLeaveWithoutSaving}
          >
            Salir sin guardar
          </button>
        </div>
      }
    />
  )
}
