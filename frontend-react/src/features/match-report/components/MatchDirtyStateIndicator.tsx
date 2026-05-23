export interface MatchDirtyStateIndicatorProps {
  readonly dirtyCount: number
  readonly isDirty: boolean
}

export function MatchDirtyStateIndicator({ dirtyCount, isDirty }: MatchDirtyStateIndicatorProps) {
  if (!isDirty) {
    return (
      <span className="text-xs text-slate-500" title="Sin cambios pendientes">
        Sin cambios pendientes
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900"
      title="Cambios no guardados"
    >
      {dirtyCount > 0 ? `${dirtyCount} campo(s) modificado(s)` : 'Cambios sin guardar'}
    </span>
  )
}
