export interface MatchClosurePanelProps {
  readonly canSave: boolean
  readonly canFinalize: boolean
  readonly busy: boolean
  readonly isReadOnly: boolean
  readonly onSave: () => void
  readonly onFinalize: () => void
  readonly onRecalculate: () => void
  readonly onReset: () => void
}

export function MatchClosurePanel({
  canSave,
  canFinalize,
  busy,
  isReadOnly,
  onSave,
  onFinalize,
  onRecalculate,
  onReset,
}: MatchClosurePanelProps) {
  if (isReadOnly) {
    return null
  }

  return (
    <section
      className="sticky bottom-3 z-10 rounded-lg border border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:px-4 sm:py-4 lg:static"
      aria-label="Cierre del acta"
    >
      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
        <button
          type="button"
          disabled={!canSave || busy}
          className="min-h-10 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
          onClick={onSave}
        >
          Guardar borrador
        </button>
        <button
          type="button"
          disabled={!canFinalize || busy}
          className="min-h-10 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 transition-colors hover:bg-red-100 active:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
          onClick={onFinalize}
        >
          Cerrar acta
        </button>
        <button
          type="button"
          disabled={busy}
          className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 sm:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
          onClick={onRecalculate}
        >
          Recalcular
        </button>
        <button
          type="button"
          disabled={busy}
          className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 sm:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
          onClick={onReset}
        >
          Deshacer cambios
        </button>
      </div>
    </section>
  )
}
