import { MatchIncidenciasField } from './MatchIncidenciasField'
import { MatchRefereeField } from './MatchRefereeField'

export interface MatchReportMetaPanelProps {
  readonly refereeName: string
  readonly incidencias: string
  readonly readOnly: boolean
  readonly isRefereeDirty: boolean
  readonly isIncidenciasDirty: boolean
  readonly onRefereeChange: (value: string) => void
  readonly onIncidenciasChange: (value: string) => void
}

export function MatchReportMetaPanel({
  refereeName,
  incidencias,
  readOnly,
  isRefereeDirty,
  isIncidenciasDirty,
  onRefereeChange,
  onIncidenciasChange,
}: MatchReportMetaPanelProps) {
  return (
    <section
      className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5"
      aria-label="Datos del encuentro"
    >
      <h2 className="text-sm font-semibold text-slate-900">Datos del encuentro</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <MatchRefereeField
          value={refereeName}
          readOnly={readOnly}
          dirty={isRefereeDirty}
          onChange={onRefereeChange}
        />
        <div className="sm:col-span-2">
          <MatchIncidenciasField
            value={incidencias}
            readOnly={readOnly}
            dirty={isIncidenciasDirty}
            onChange={onIncidenciasChange}
          />
        </div>
      </div>
    </section>
  )
}
