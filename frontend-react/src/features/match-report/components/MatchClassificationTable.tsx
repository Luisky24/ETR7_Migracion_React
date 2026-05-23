import type { ClassificationRowView } from '../selectors/matchReportUiSelectors'

export interface MatchClassificationTableProps {
  readonly rows: readonly ClassificationRowView[]
  readonly compact?: boolean
}

export function MatchClassificationTable({ rows, compact = false }: MatchClassificationTableProps) {
  const cellPad = compact ? 'px-2 py-1.5' : 'px-3 py-2'
  const headerClass = compact
    ? 'border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500'
    : 'border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600'

  return (
    <table className="mx-auto w-full max-w-md border-collapse text-sm">
      <thead>
        <tr className={headerClass}>
          <th className={`${cellPad} text-left`}>Equipo</th>
          <th className={`${cellPad} text-center`}>P</th>
          <th className={`${cellPad} text-center`}>BO</th>
          <th className={`${cellPad} text-center`}>BD</th>
          <th className={`${cellPad} text-center`}>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.side} className="border-b border-slate-100 last:border-0">
            <td className={`${cellPad} font-medium text-slate-800`}>{row.equipo}</td>
            <td className={`${cellPad} text-center tabular-nums text-slate-700`}>{row.P}</td>
            <td className={`${cellPad} text-center tabular-nums text-slate-700`}>{row.BO}</td>
            <td className={`${cellPad} text-center tabular-nums text-slate-700`}>{row.BD}</td>
            <td className={`${cellPad} text-center font-semibold tabular-nums text-slate-900`}>
              {row.Total}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
