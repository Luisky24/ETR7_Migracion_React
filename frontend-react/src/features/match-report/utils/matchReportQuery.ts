import type { CalendarCategory, CalendarMatchDto, CalendarPhase } from '@/features/calendar/contracts/calendar.contract'
import { calendarRecordKeyForDto } from '@/features/calendar/adapters/calendar.adapter'
import { matchContextFromCalendar } from '../adapters/calendar.mapper'
import type { MatchContext } from '../contracts'

function parseCategory(raw: string | null): CalendarCategory | null {
  if (raw === 'M' || raw === 'F') return raw
  return null
}

function parsePhase(raw: string | null): CalendarPhase | null {
  if (raw === 'Fase I' || raw === 'Fase II') return raw
  return null
}

/** Clave estable de query string (dependencia de effects). */
export function matchReportSearchKey(sp: URLSearchParams): string {
  return sp.toString()
}

/** Clave de carga idempotente por encuentro (evita hydrate repetido). */
export function matchContextLoadKey(context: MatchContext): string {
  return `${context.category}|${context.phase}|${context.encuentroId}|${context.referenciaEncuentro}`
}

/** Construye MatchContext desde query params de navegación (Calendario → Acta). */
export function matchContextFromSearchParams(sp: URLSearchParams): MatchContext | null {
  const categoria = parseCategory(sp.get('categoria'))
  const fase = parsePhase(sp.get('fase'))
  const encuentroId = sp.get('encuentroId')?.trim() ?? sp.get('rk')?.trim() ?? ''
  if (!categoria || !fase || !encuentroId) return null

  const match: CalendarMatchDto = {
    encuentroId,
    grupo: sp.get('grupo')?.trim() ?? '',
    equipoLocal: sp.get('equipoLocal')?.trim() ?? '',
    equipoVisitante: sp.get('equipoVisitante')?.trim() ?? '',
    hora: sp.get('hora') ?? '',
    campo: sp.get('campo') ?? '',
    resultadoDisplay: sp.get('resultado') ?? '',
    estadoAlineacionesDisplay: sp.get('estadoAli') ?? '',
    estadoPartido: (sp.get('estadoPartido') as CalendarMatchDto['estadoPartido']) ?? 'unspecified',
    referenciaEncuentro: sp.get('ref') ?? '',
  }

  return matchContextFromCalendar(categoria, fase, match)
}

export function buildMatchReportSearchParams(input: {
  readonly calendarFilters: { readonly categoria: CalendarCategory; readonly fase: CalendarPhase }
  readonly match: CalendarMatchDto
}): string {
  const rk = calendarRecordKeyForDto(input.match)
  const p = new URLSearchParams({
    categoria: input.calendarFilters.categoria,
    fase: input.calendarFilters.fase,
    rk,
    encuentroId: input.match.encuentroId,
    grupo: input.match.grupo,
    equipoLocal: input.match.equipoLocal,
    equipoVisitante: input.match.equipoVisitante,
    hora: input.match.hora,
    campo: input.match.campo,
    resultado: input.match.resultadoDisplay,
    estadoAli: input.match.estadoAlineacionesDisplay,
    estadoPartido: input.match.estadoPartido,
    ref: input.match.referenciaEncuentro,
  })
  return p.toString()
}
