import type { ReactNode } from 'react'
import type { MatchTeam } from '../contracts'

export interface MatchTeamCardProps {
  readonly team: MatchTeam
  readonly children: ReactNode
  readonly readOnly?: boolean
}

export function MatchTeamCard({ team, children, readOnly = false }: MatchTeamCardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <h3 className="text-base font-semibold tracking-tight text-slate-900">{team.equipo}</h3>
        <p className="mt-1 text-xs text-slate-600">
          Delegado: {team.delegado || '—'} · Entrenador: {team.entrenador || '—'}
        </p>
        {readOnly ? (
          <p className="mt-1 text-xs font-medium text-slate-500">Solo lectura</p>
        ) : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}
