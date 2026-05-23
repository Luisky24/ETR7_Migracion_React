export interface MatchRefereeFieldProps {
  readonly value: string
  readonly readOnly: boolean
  readonly dirty?: boolean
  readonly onChange: (value: string) => void
}

export function MatchRefereeField({ value, readOnly, dirty = false, onChange }: MatchRefereeFieldProps) {
  return (
    <div>
      <label htmlFor="match-referee-name" className="text-sm font-medium text-slate-700">
        Árbitro
      </label>
      <input
        id="match-referee-name"
        type="text"
        value={value}
        readOnly={readOnly}
        disabled={readOnly}
        maxLength={120}
        placeholder="Nombre del árbitro"
        className={`mt-1 w-full rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600 ${
          dirty ? 'border-amber-400 bg-amber-50/40' : 'border-slate-300 bg-white'
        }`}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
