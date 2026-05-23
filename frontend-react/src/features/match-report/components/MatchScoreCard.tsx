import type { MatchResult } from '../domain/matchResult'
import type { MatchScore } from '../contracts'
import { formatMatchResultLabel } from '../presentation/matchResultLabels'
import type { ClassificationRowView } from '../selectors/matchReportUiSelectors'

export interface MatchScoreCardProps {
  readonly score: MatchScore
  readonly result: MatchResult
  readonly headerTitle: string
  readonly headerSubtitle: string
  readonly classificationRows: readonly ClassificationRowView[]
}

export function MatchScoreCard({
  score,
  result,
  headerTitle,
  headerSubtitle,
  classificationRows,
}: MatchScoreCardProps) {
  const resultLabel = formatMatchResultLabel(result)
  const local = classificationRows.find((r) => r.side === 'local') ?? classificationRows[0]
  const visit = classificationRows.find((r) => r.side === 'visitante') ?? classificationRows[1]

  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
      <div className="text-center">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
          Acta del encuentro
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-700">{headerTitle}</p>
        <p className="mt-0.5 text-xs text-slate-500">{headerSubtitle}</p>
      </div>

      <div className="mt-4">
        <p className="text-center text-2xl font-bold tabular-nums leading-none text-slate-900 sm:text-3xl">
          {score.local}
          <span className="mx-2 font-light text-slate-300 sm:mx-3">—</span>
          {score.visitante}
        </p>
        <p className="mt-1 text-center text-xs text-slate-500">{resultLabel}</p>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
          <div className="flex-1 px-0 sm:px-4">
            <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              🏆 Puntuación
            </p>
            <p className="mt-1 text-center text-xs text-slate-700">
              <span className="font-medium">P</span> {local?.P ?? 0}
              <span className="mx-2 text-slate-300">|</span>
              <span className="font-medium">BO</span> {local?.BO ?? 0}
              <span className="mx-2 text-slate-300">|</span>
              <span className="font-medium">BD</span> {local?.BD ?? 0}
              <span className="mx-2 text-slate-300">|</span>
              <span className="font-medium">TOTAL</span>{' '}
              <span className="font-semibold tabular-nums text-slate-900">{local?.Total ?? 0}</span>
            </p>
          </div>

          <div className="hidden w-px bg-slate-200 sm:block" aria-hidden />

          <div className="flex-1 px-0 sm:px-4">
            <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              🏆 Puntuación
            </p>
            <p className="mt-1 text-center text-xs text-slate-700">
              <span className="font-medium">P</span> {visit?.P ?? 0}
              <span className="mx-2 text-slate-300">|</span>
              <span className="font-medium">BO</span> {visit?.BO ?? 0}
              <span className="mx-2 text-slate-300">|</span>
              <span className="font-medium">BD</span> {visit?.BD ?? 0}
              <span className="mx-2 text-slate-300">|</span>
              <span className="font-medium">TOTAL</span>{' '}
              <span className="font-semibold tabular-nums text-slate-900">{visit?.Total ?? 0}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
