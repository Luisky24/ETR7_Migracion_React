import type { TeamSide } from '../contracts'

export interface MatchTeamObservationsFieldProps {
  readonly side: TeamSide
  readonly teamName: string
  readonly value: string
  readonly readOnly: boolean
  readonly dirty?: boolean
  readonly onChange: (value: string) => void
}

export function MatchTeamObservationsField({
  side,
  teamName,
  value,
  readOnly,
  dirty = false,
  onChange,
}: MatchTeamObservationsFieldProps) {
  const id = `match-observaciones-${side}`

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        Observaciones — {teamName}
      </label>
      <textarea
        id={id}
        rows={3}
        value={value}
        readOnly={readOnly}
        disabled={readOnly}
        maxLength={2000}
        placeholder="Notas u observaciones del equipo"
        className={`mt-1 w-full resize-y rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600 ${
          dirty ? 'border-amber-400 bg-amber-50/40' : 'border-slate-300 bg-white'
        }`}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
