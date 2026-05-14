import type { CalendarCategory, CalendarMatchDto, CalendarPhase } from '@/features/calendar/contracts/calendar.contract'
import type {
  TeamLineupConfirmRequest,
  TeamLineupContextRequest,
  TeamLineupPlayerDto,
  TeamLineupSaveRequest,
} from '../contracts/teamLineupContext.contract'

function parseCategory(raw: string | null): CalendarCategory | null {
  if (raw === 'M' || raw === 'F') return raw
  return null
}

function parsePhase(raw: string | null): CalendarPhase | null {
  if (raw === 'Fase I' || raw === 'Fase II') return raw
  return null
}

/**
 * Construye la petición al boundary a partir de query params (F5 persistente).
 */
export function teamLineupContextRequestFromSearchParams(
  sp: URLSearchParams,
  nivelAcceso: number,
  sesionEquipo: string | undefined,
): TeamLineupContextRequest | null {
  const categoria = parseCategory(sp.get('categoria'))
  const fase = parsePhase(sp.get('fase'))
  const recordKey = sp.get('rk')?.trim() ?? ''
  const equipoOperativo = sp.get('equipo')?.trim() ?? ''
  if (!categoria || !fase || !recordKey || !equipoOperativo) return null

  const grupo = sp.get('grupo')?.trim() ?? ''
  const hora = sp.get('hora') ?? ''
  const campo = sp.get('campo') ?? ''
  const resultado = sp.get('resultado') ?? ''
  const estadoAlineaciones = sp.get('estadoAli') ?? ''
  const estadoPartido = sp.get('estadoPartido') ?? ''
  const referenciaEncuentro = sp.get('ref') ?? ''

  const snap: Record<string, string> = {}
  if (grupo) snap.grupo = grupo
  if (hora) snap.hora = hora
  if (campo) snap.campo = campo
  if (resultado) snap.resultado = resultado
  if (estadoAlineaciones) snap.estadoAlineaciones = estadoAlineaciones
  if (estadoPartido) snap.estadoPartido = estadoPartido
  if (referenciaEncuentro) snap.referenciaEncuentro = referenciaEncuentro

  const matchSnapshot =
    Object.keys(snap).length > 0 ? (snap as NonNullable<TeamLineupContextRequest['matchSnapshot']>) : undefined

  const req: TeamLineupContextRequest = {
    categoria,
    fase,
    recordKey,
    equipoOperativo,
    nivelAcceso,
    ...(matchSnapshot ? { matchSnapshot } : {}),
    ...(sesionEquipo && sesionEquipo.trim() !== '' ? { sesionEquipo: sesionEquipo.trim() } : {}),
  }
  return req
}

/** Construye petición SAVE (misma base que GET + staff + plantilla jugadores). */
export function buildTeamLineupSaveRequest(
  sp: URLSearchParams,
  nivelAcceso: number,
  sesionEquipo: string | undefined,
  delegado: string,
  entrenador: string,
  jugadores: readonly TeamLineupPlayerDto[],
): TeamLineupSaveRequest | null {
  const base = teamLineupContextRequestFromSearchParams(sp, nivelAcceso, sesionEquipo)
  if (!base) return null
  return {
    ...base,
    delegado,
    entrenador,
    jugadores,
  }
}

/** Petición CONFIRM (misma forma que SAVE). */
export function buildTeamLineupConfirmRequest(
  sp: URLSearchParams,
  nivelAcceso: number,
  sesionEquipo: string | undefined,
  delegado: string,
  entrenador: string,
  jugadores: readonly TeamLineupPlayerDto[],
): TeamLineupConfirmRequest | null {
  return buildTeamLineupSaveRequest(sp, nivelAcceso, sesionEquipo, delegado, entrenador, jugadores)
}
export function buildTeamLineupContextSearchParams(input: {
  readonly calendarFilters: { readonly categoria: CalendarCategory; readonly fase: CalendarPhase }
  readonly recordKey: string
  readonly equipoOperativo: string
  readonly match: CalendarMatchDto
}): string {
  const p = new URLSearchParams({
    categoria: input.calendarFilters.categoria,
    fase: input.calendarFilters.fase,
    rk: input.recordKey,
    equipo: input.equipoOperativo,
    grupo: input.match.grupo,
    hora: input.match.hora,
    campo: input.match.campo,
    resultado: input.match.resultadoDisplay,
    estadoAli: input.match.estadoAlineacionesDisplay,
    estadoPartido: input.match.estadoPartido,
    ref: input.match.referenciaEncuentro,
  })
  return p.toString()
}
