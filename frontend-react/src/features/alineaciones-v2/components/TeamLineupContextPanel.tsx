import type { TeamLineupContextResponse, TeamLineupPlayerDto } from '../contracts/teamLineupContext.contract'

export interface TeamLineupDraftState {
  delegado: string
  entrenador: string
  jugadores: TeamLineupPlayerDto[]
}

interface TeamLineupContextPanelProps {
  readonly data: TeamLineupContextResponse
  readonly draft: TeamLineupDraftState | null
  readonly onDraftChange: (next: TeamLineupDraftState) => void
  readonly softWarnings: readonly string[]
  readonly onSave?: () => void
  readonly saveBusy?: boolean
  readonly saveError?: string | null
  readonly confirmHardErrors: readonly string[]
  readonly canConfirm: boolean
  readonly confirmAck: boolean
  readonly onConfirmAckChange: (next: boolean) => void
  readonly onConfirm?: () => void
  readonly confirmBusy?: boolean
  readonly confirmError?: string | null
}

export function TeamLineupContextPanel({
  data,
  draft,
  onDraftChange,
  softWarnings,
  onSave,
  saveBusy,
  saveError,
  confirmHardErrors,
  canConfirm,
  confirmAck,
  onConfirmAckChange,
  onConfirm,
  confirmBusy,
  confirmError,
}: TeamLineupContextPanelProps) {
  const { context, permissions, workflow, flags, metadata } = data
  const { match } = context
  const canEdit = permissions.canEdit && draft != null

  const staffConfirmWarnings: string[] = []
  if (canConfirm && draft) {
    if (!draft.delegado.trim()) {
      staffConfirmWarnings.push('Delegado vacío (no bloquea la confirmación).')
    }
    if (!draft.entrenador.trim()) {
      staffConfirmWarnings.push('Entrenador vacío (no bloquea la confirmación).')
    }
  }

  const editLabel = permissions.protectedMode
    ? 'Protegido (solo lectura)'
    : permissions.canEdit
      ? 'Editable'
      : 'Solo lectura'

  const roster = canEdit ? draft!.jugadores : context.jugadores
  const delegadoVal = canEdit ? draft!.delegado : context.delegado
  const entrenadorVal = canEdit ? draft!.entrenador : context.entrenador

  function patchDraft(patch: Partial<TeamLineupDraftState>) {
    if (!draft) return
    onDraftChange({ ...draft, ...patch })
  }

  function patchPlayer(i: number, patch: Partial<TeamLineupPlayerDto>) {
    if (!draft) return
    const jugadores = draft.jugadores.map((p, ii) => (ii === i ? { ...p, ...patch } : p))
    onDraftChange({ ...draft, jugadores })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Encuentro</h2>
        <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Etiqueta</dt>
            <dd>{match.encuentroLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Grupo</dt>
            <dd>{match.grupo || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Equipo operativo</dt>
            <dd className="font-medium text-slate-900">{context.equipoOperativo}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Perspectiva</dt>
            <dd>{context.indLocalVisitante === 'L' ? 'Local' : 'Visitante'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Contrario</dt>
            <dd>{context.contrario || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Origen modelo</dt>
            <dd>{context.origenModelo}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Workflow y permisos</h2>
        <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Estado partido</dt>
            <dd>{workflow.matchState}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Slot equipo (cal.)</dt>
            <dd>{workflow.teamSlotState}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Slot rival (cal.)</dt>
            <dd>{workflow.opponentSlotState}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Estado hoja ENC</dt>
            <dd>{workflow.sheetStateEnc ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Rol / nivel</dt>
            <dd>
              {context.role} ({context.nivelAcceso})
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Modo UI</dt>
            <dd>{editLabel}</dd>
          </div>
        </dl>
        <ul className="mt-3 list-disc pl-5 text-xs text-slate-600">
          <li>canRead: {String(permissions.canRead)}</li>
          <li>canEdit: {String(permissions.canEdit)}</li>
          <li>canConfirm: {String(permissions.canConfirm)}</li>
          <li>canSelectTeam: {String(permissions.canSelectTeam)}</li>
          <li>protectedMode: {String(permissions.protectedMode)}</li>
        </ul>
        {permissions.reasonCodes.length > 0 ? (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="font-semibold">reasonCodes: </span>
            {permissions.reasonCodes.join(', ')}
          </div>
        ) : null}
        <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">
          <li>cerradaPorActa: {String(flags.cerradaPorActa)}</li>
          <li>fromActaSnapshot: {String(flags.fromActaSnapshot)}</li>
          <li>staleRiskEncVsCalendar: {String(flags.staleRiskEncVsCalendar)}</li>
          <li>serverTime: {metadata.serverTime || '—'}</li>
        </ul>
      </section>

      {softWarnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Avisos (no bloquean guardar)</p>
          <ul className="mt-2 list-disc pl-5">
            {softWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{saveError}</div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Staff técnico</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase text-slate-500" htmlFor="tl-delegado">
              Delegado
            </label>
            <input
              id="tl-delegado"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
              value={delegadoVal}
              disabled={!canEdit}
              onChange={(e) => {
                patchDraft({ delegado: e.target.value })
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-slate-500" htmlFor="tl-entrenador">
              Entrenador
            </label>
            <input
              id="tl-entrenador"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
              value={entrenadorVal}
              disabled={!canEdit}
              onChange={(e) => {
                patchDraft({ entrenador: e.target.value })
              }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-900">Jugadores</h2>
          {permissions.canEdit && onSave ? (
            <button
              type="button"
              className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              disabled={!!saveBusy || !draft}
              onClick={() => {
                onSave()
              }}
            >
              {saveBusy ? 'Guardando…' : 'Guardar alineación'}
            </button>
          ) : null}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Titular</th>
                <th className="px-3 py-2">Suplente</th>
                <th className="px-3 py-2">Capitán</th>
                <th className="px-3 py-2">Dorsal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {roster.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">
                    Sin jugadores en el modelo.
                  </td>
                </tr>
              ) : (
                roster.map((j, i) => (
                  <tr key={`${j.nombre}-${i}`}>
                    <td className="px-3 py-2">{j.nombre}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={j.titular}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const checked = e.target.checked
                          if (checked) {
                            patchPlayer(i, { titular: true, suplente: false })
                          } else {
                            patchPlayer(i, { titular: false })
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={j.suplente}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const checked = e.target.checked
                          if (checked) {
                            patchPlayer(i, { suplente: true, titular: false })
                          } else {
                            patchPlayer(i, { suplente: false })
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={j.capitan}
                        disabled={!canEdit}
                        onChange={(e) => {
                          patchPlayer(i, { capitan: e.target.checked })
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-16 rounded border border-slate-300 px-1 py-0.5 text-sm disabled:bg-slate-100"
                        value={j.dorsal != null && j.dorsal > 0 ? String(j.dorsal) : ''}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 2)
                          const n = v === '' ? null : parseInt(v, 10)
                          patchPlayer(i, {
                            dorsal: n != null && !Number.isNaN(n) && n > 0 ? n : null,
                          })
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canConfirm && draft ? (
        <section className="rounded-lg border border-slate-300 bg-slate-50 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Confirmación oficial</h2>
          <p className="mt-2 text-sm text-slate-600">
            Al confirmar se delega en el backend legacy (<code className="rounded bg-white px-1">confirmarAlineacionSPA</code>):
            calendario en <strong>C</strong> y, si ambos equipos confirman, apertura de acta según reglas existentes.
          </p>
          {staffConfirmWarnings.length > 0 ? (
            <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">Avisos</p>
              <ul className="mt-1 list-disc pl-5">
                {staffConfirmWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {confirmHardErrors.length > 0 ? (
            <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
              <p className="font-medium">Debe corregir lo siguiente antes de confirmar</p>
              <ul className="mt-1 list-disc pl-5">
                {confirmHardErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {confirmError ? (
            <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{confirmError}</div>
          ) : null}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmAck}
                onChange={(e) => {
                  onConfirmAckChange(e.target.checked)
                }}
              />
              <span>
                Confirmo que la alineación es definitiva para este encuentro y acepto que quedará bloqueada para edición
                (misma regla que el flujo clásico).
              </span>
            </label>
            {onConfirm ? (
              <button
                type="button"
                className="shrink-0 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
                disabled={
                  confirmHardErrors.length > 0 || !confirmAck || !!confirmBusy || !draft
                }
                onClick={() => {
                  onConfirm()
                }}
              >
                {confirmBusy ? 'Confirmando…' : 'Confirmar alineación'}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
