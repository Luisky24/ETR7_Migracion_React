export interface MatchIncidenciasFieldProps {
  readonly value: string
  readonly readOnly: boolean
  readonly dirty?: boolean
  readonly onChange: (value: string) => void
}

export function MatchIncidenciasField({
  value,
  readOnly,
  dirty = false,
  onChange,
}: MatchIncidenciasFieldProps) {
  return (
    <div>
      <label htmlFor="match-incidencias" className="text-sm font-medium text-slate-700">
        Incidencias del encuentro
      </label>
      <textarea
        id="match-incidencias"
        rows={3}
        value={value}
        readOnly={readOnly}
        disabled={readOnly}
        maxLength={4000}
        placeholder="Incidencias generales del partido"
        className={`mt-1 w-full resize-y rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600 ${
          dirty ? 'border-amber-400 bg-amber-50/40' : 'border-slate-300 bg-white'
        }`}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
