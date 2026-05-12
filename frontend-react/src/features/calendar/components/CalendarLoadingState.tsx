export function CalendarLoadingState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-6 py-12 text-center"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
        aria-hidden
      />
      <p className="text-sm text-slate-600">Cargando encuentros…</p>
    </div>
  )
}
