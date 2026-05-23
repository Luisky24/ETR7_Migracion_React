import type { ClassificationRowView } from '../selectors/matchReportUiSelectors'
import { MatchClassificationTable } from './MatchClassificationTable'

export interface MatchClassificationPanelProps {
  readonly rows: readonly ClassificationRowView[]
}

/** @deprecated Clasificación integrada en MatchScoreCard; se mantiene para compatibilidad de tests. */
export function MatchClassificationPanel({ rows }: MatchClassificationPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
        Clasificación (vista previa)
      </h2>
      <div className="mt-3 overflow-x-auto">
        <MatchClassificationTable rows={rows} />
      </div>
    </section>
  )
}
