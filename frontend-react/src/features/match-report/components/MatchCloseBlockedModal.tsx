import type { MatchValidationIssue } from '../contracts'
import { MatchDialogShell } from './MatchDialogShell'

export interface MatchCloseBlockedModalProps {
  readonly open: boolean
  readonly issues: readonly MatchValidationIssue[]
  readonly onDismiss: () => void
}

export function MatchCloseBlockedModal({ open, issues, onDismiss }: MatchCloseBlockedModalProps) {
  return (
    <MatchDialogShell
      open={open}
      titleId="close-blocked-title"
      title="No se puede cerrar el acta"
      onBackdropClick={onDismiss}
      onCancel={onDismiss}
      autoFocusPrimary
      restoreFocusOnClose={false}
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            data-dialog-primary
            className="min-h-10 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 active:bg-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
            onClick={onDismiss}
          >
            Volver al acta
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-700">Corrija las siguientes incidencias antes de cerrar:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
        {issues.map((issue) => (
          <li key={issue.code}>{issue.message}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Enter o Escape para volver al acta</p>
    </MatchDialogShell>
  )
}
