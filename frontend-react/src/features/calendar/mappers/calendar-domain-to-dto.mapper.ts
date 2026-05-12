import type { CalendarMatchDto } from '../contracts/calendar.contract'
import type { CalendarMatch } from '../types/calendar-domain.types'

export function calendarMatchToDto(entity: CalendarMatch): CalendarMatchDto {
  return {
    encuentroId: entity.encuentroId,
    grupo: entity.grupo,
    equipoLocal: entity.equipoLocal,
    equipoVisitante: entity.equipoVisitante,
    hora: entity.hora,
    campo: entity.campo,
    resultadoDisplay: entity.resultadoDisplay,
    estadoAlineacionesDisplay: entity.estadoAlineacionesDisplay,
    estadoPartido: entity.estadoPartido,
    referenciaEncuentro: entity.referenciaEncuentro,
  }
}
