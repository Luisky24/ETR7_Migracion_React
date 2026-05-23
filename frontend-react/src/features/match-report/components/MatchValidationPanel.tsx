import type { MatchValidationIssue, MatchValidationResult } from '../contracts'

export interface MatchValidationPanelProps {
  readonly bundle: {
    readonly draft: MatchValidationResult | null
    readonly close: MatchValidationResult | null
    readonly scoreCoherence: MatchValidationResult | null
    readonly lastInteraction: MatchValidationResult | null
    readonly hasIssues: boolean
  }
}

function IssueList({
  title,
  result,
}: {
  readonly title: string
  readonly result: MatchValidationResult | null
}) {
  if (!result) return null
  const hasContent = result.errors.length > 0 || result.warnings.length > 0
  if (!hasContent) return null

  return (
    <div className="mt-3">
      <h3 className="text-xs font-semibold uppercase text-slate-600">{title}</h3>
      {result.errors.length > 0 ? (
        <ul className="mt-1 list-disc pl-5 text-sm text-red-800">
          {result.errors.map((issue: MatchValidationIssue) => (
            <li key={`${title}-e-${issue.code}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
      {result.warnings.length > 0 ? (
        <ul className="mt-1 list-disc pl-5 text-sm text-amber-800">
          {result.warnings.map((issue: MatchValidationIssue) => (
            <li key={`${title}-w-${issue.code}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function MatchValidationPanel({ bundle }: MatchValidationPanelProps) {
  if (!bundle.hasIssues) {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-sm text-emerald-900">
        Validaciones de dominio: sin incidencias detectadas.
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
      <h2 className="text-sm font-semibold text-amber-950">Validaciones</h2>
      <IssueList title="Borrador" result={bundle.draft} />
      <IssueList title="Cierre" result={bundle.close} />
      <IssueList title="Marcador / acciones" result={bundle.scoreCoherence} />
      <IssueList title="Última interacción" result={bundle.lastInteraction} />
    </section>
  )
}
