import type { CalendarCategory, CalendarFilters, CalendarPhase } from '../contracts/calendar.contract'

interface CalendarFiltersBarProps {
  readonly filters: CalendarFilters
  readonly loading: boolean
  readonly onCategoryChange: (value: CalendarCategory) => void
  readonly onPhaseChange: (value: CalendarPhase) => void
  readonly onRefresh: () => void
}

export function CalendarFiltersBar({
  filters,
  loading,
  onCategoryChange,
  onPhaseChange,
  onRefresh,
}: CalendarFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
      <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Categoría</span>
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-60"
          value={filters.categoria}
          disabled={loading}
          onChange={(e) => {
            onCategoryChange(e.target.value as CalendarCategory)
          }}
          aria-label="Categoría"
        >
          <option value="M">Masculino</option>
          <option value="F">Femenino</option>
        </select>
      </label>

      <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Fase</span>
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-60"
          value={filters.fase}
          disabled={loading}
          onChange={(e) => {
            onPhaseChange(e.target.value as CalendarPhase)
          }}
          aria-label="Fase"
        >
          <option value="Fase I">Fase I</option>
          <option value="Fase II">Fase II</option>
        </select>
      </label>

      <div className="flex flex-1 items-end sm:justify-end">
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          onClick={onRefresh}
        >
          Refrescar
        </button>
      </div>
    </div>
  )
}
