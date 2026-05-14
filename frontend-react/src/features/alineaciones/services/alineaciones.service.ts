/**
 * Lectura alineaciones (solo boundary oficial).
 */

import { log } from '@/core/debug'
import { gasTransport } from '@/transport/gasTransport'
import type { CalendarCategory, CalendarPhase } from '@/features/calendar/contracts/calendar.contract'
import type { MatchLineupsResponse } from '../contracts/alineaciones.contract'
import { adaptAlineacionesGetMatchLineupsV2Response } from '../adapters/alineaciones.adapter'

const GAS_ALINEACIONES_GET_MATCH_LINEUPS_V2 = 'alineaciones_getMatchLineups_v2'

function categoryToGasLabel(categoria: CalendarCategory): 'Masculina' | 'Femenina' {
  return categoria === 'M' ? 'Masculina' : 'Femenina'
}

export const alineacionesService = {
  async getMatchLineups(input: {
    categoria: CalendarCategory
    fase: CalendarPhase
    recordKey: string
  }): Promise<MatchLineupsResponse | null> {
    const categoriaTexto = categoryToGasLabel(input.categoria)
    log.debug('alineaciones.getMatchLineups.start', {
      categoria: input.categoria,
      fase: input.fase,
    })
    try {
      const raw: unknown = await gasTransport.call<unknown>(
        GAS_ALINEACIONES_GET_MATCH_LINEUPS_V2,
        categoriaTexto,
        input.fase,
        input.recordKey,
      )
      const adapted = adaptAlineacionesGetMatchLineupsV2Response(raw)
      log.debug('alineaciones.getMatchLineups.ok', {
        encuentroId: adapted?.encuentroId,
      })
      return adapted
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      log.error('alineaciones.getMatchLineups.error', {
        message,
        categoria: input.categoria,
        fase: input.fase,
      })
      throw e
    }
  },
} as const
