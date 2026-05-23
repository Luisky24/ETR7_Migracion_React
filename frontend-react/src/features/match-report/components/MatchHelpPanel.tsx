import type { MatchHelpContent, MatchHelpItem } from '../selectors/matchReportValidationUxSelectors'
import { MatchDialogShell } from './MatchDialogShell'

const ITEM_CLASS: Record<MatchHelpItem['kind'], string> = {
  info: 'text-slate-700',
  warning: 'text-amber-900',
  tip: 'text-slate-600',
}

export interface MatchHelpPanelProps {
  readonly open: boolean
  readonly content: MatchHelpContent
  readonly onClose: () => void
}

export function MatchHelpPanel({ open, content, onClose }: MatchHelpPanelProps) {
  return (
    <MatchDialogShell
      open={open}
      titleId="match-help-title"
      title="Ayuda — acta del encuentro"
      onBackdropClick={onClose}
      onCancel={onClose}
      autoFocusPrimary
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            data-dialog-primary
            className="min-h-10 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 active:bg-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      }
    >
      <div className="max-h-[min(60vh,28rem)] space-y-4 overflow-y-auto pr-1">
        {content.sections.map((section) => (
          <section key={section.id}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {section.title}
            </h3>
            <ul className="mt-2 space-y-2">
              {section.items.map((item) => (
                <li
                  key={`${section.id}-${item.code ?? item.message.slice(0, 24)}`}
                  className={`text-sm leading-snug ${ITEM_CLASS[item.kind]}`}
                >
                  {item.message}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </MatchDialogShell>
  )
}
