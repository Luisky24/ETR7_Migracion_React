export function CalendarEmptyState() {
  return (
    <div
      className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center"
      role="status"
    >
      <p className="text-sm font-medium text-slate-700">No hay encuentros</p>
      <p className="mt-2 text-sm text-slate-500">
        No se encontraron filas para la categoría y fase seleccionadas.
      </p>
    </div>
  )
}
