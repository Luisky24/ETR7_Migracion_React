import type { MatchScore, MatchStatus } from '../contracts'
import type { MatchResult } from '../domain/matchResult'
import { MatchDialogShell } from './MatchDialogShell'

export type MatchFinalizeConfirmVariant = 'normal' | 'empty_close'

export interface MatchFinalizeConfirmModalProps {
  readonly open: boolean
  readonly busy: boolean
  readonly score: MatchScore
  readonly result: MatchResult
  readonly matchStatus: MatchStatus
  readonly teamLocalName: string
  readonly teamVisitName: string
  readonly variant: MatchFinalizeConfirmVariant
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

function formatMatchStatus(status: MatchStatus): string {
  switch (status) {
    case 'acta_abierta':
      return 'Acta abierta'
    case 'acta_cerrada':
      return 'Acta cerrada'
    case 'sin_alineacion':
      return 'Sin alineación'
    case 'alineacion_parcial':
      return 'Alineación parcial'
  }
}

function formatResultLabel(result: MatchResult, localName: string, visitName: string): string {
  switch (result) {
    case 'local_win':
      return `Victoria ${localName}`
    case 'visitante_win':
      return `Victoria ${visitName}`
    case 'draw':
      return 'Empate'
  }
}

export function MatchFinalizeConfirmModal({
  open,
  busy,
  score,
  result,
  matchStatus,
  teamLocalName,
  teamVisitName,
  variant,
  onCancel,
  onConfirm,
}: MatchFinalizeConfirmModalProps) {
  return (
    <MatchDialogShell
      open={open}
      titleId="finalize-close-title"
      title="Confirmar cierre del acta"
      busy={busy}
      onBackdropClick={busy ? undefined : onCancel}
      onCancel={busy ? undefined : onCancel}
      onConfirm={busy ? undefined : onConfirm}
      autoFocusPrimary
      restoreFocusOnClose={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-dialog-cancel
            autoFocus
            className="min-h-10 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={onCancel}
          >
            Volver al acta
          </button>
          <button
            type="button"
            data-dialog-primary
            className="min-h-10 rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-900 active:bg-red-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={onConfirm}
          >
            Confirmar cierre
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Marcador</dt>
              <dd className="font-semibold text-slate-900">
                {teamLocalName} {score.local} - {score.visitante} {teamVisitName}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Resultado</dt>
              <dd className="font-semibold text-slate-900">
                {formatResultLabel(result, teamLocalName, teamVisitName)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Estado del partido</dt>
              <dd className="text-slate-900">{formatMatchStatus(matchStatus)}</dd>
            </div>
          </dl>
        </div>

        {variant === 'empty_close' ? (
          <p className="text-sm text-slate-700">
            El acta no contiene acciones registradas. Va a cerrar igualmente el encuentro con este
            marcador.
            <br />
            Confirme para continuar.
          </p>
        ) : (
          <p className="text-sm text-slate-700">
            Va a cerrar definitivamente el acta del encuentro.
            <br />
            Tras el cierre no podrá editar la información.
          </p>
        )}

        <p className="text-xs text-slate-500">Enter confirma el cierre · Escape vuelve al acta</p>
      </div>
    </MatchDialogShell>
  )
}
