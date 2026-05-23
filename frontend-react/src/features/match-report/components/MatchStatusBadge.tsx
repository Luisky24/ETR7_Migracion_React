import type { MatchReportOperationStatus } from '../types/matchReportOperation.types'
import type { OperationBannerVariant } from '../selectors/matchReportUiSelectors'

const VARIANT_CLASS: Record<OperationBannerVariant, string> = {
  neutral: 'bg-slate-100 text-slate-800 border-slate-200',
  busy: 'bg-sky-50 text-sky-900 border-sky-200',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  error: 'bg-red-50 text-red-900 border-red-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
}

export interface MatchStatusBadgeProps {
  readonly operation: MatchReportOperationStatus
  readonly label: string
  readonly variant?: OperationBannerVariant
}

export function MatchStatusBadge({ operation, label, variant = 'neutral' }: MatchStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${VARIANT_CLASS[variant]}`}
      title={operation}
    >
      <span className="font-mono text-[10px] opacity-70">{operation}</span>
      <span>{label}</span>
    </span>
  )
}
