/**
 * API de aplicación para lectura de calendario.
 * Sin UI, sin estado global; solo orquestación transporte + adapter.
 */

import { log } from '@/core/debug'
import { gasTransport } from '@/transport/gasTransport'
import type { CalendarFilters, CalendarMatchesResponse } from '../contracts/calendar.contract'
import { adaptCalendarGetMatchesV2Response } from '../adapters/calendar.adapter'

/** Boundary oficial GAS ↔ React (calendario read-only). */
const GAS_CALENDAR_GET_MATCHES_V2 = 'calendar_getMatches_v2'

function categoryToGasLabel(categoria: CalendarFilters['categoria']): 'Masculina' | 'Femenina' {
  return categoria === 'M' ? 'Masculina' : 'Femenina'
}

export const calendarService = {
  /**
   * Lectura de encuentros para la subpestaña Calendario (misma semántica que legacy SPA).
   */
  async getMatches(filters: CalendarFilters): Promise<CalendarMatchesResponse> {
    const categoriaTexto = categoryToGasLabel(filters.categoria)
    log.debug('calendar.getMatches.start', {
      categoria: filters.categoria,
      fase: filters.fase,
    })
    try {
      const raw: unknown = await gasTransport.call<unknown>(
        GAS_CALENDAR_GET_MATCHES_V2,
        categoriaTexto,
        filters.fase,
      )
      const adapted = adaptCalendarGetMatchesV2Response(raw)
      log.debug('calendar.getMatches.ok', {
        rowCount: Object.keys(adapted.matchesByEncuentroId).length,
      })
      return adapted
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      log.error('calendar.getMatches.error', {
        message,
        categoria: filters.categoria,
        fase: filters.fase,
      })
      throw e
    }
  },
} as const
