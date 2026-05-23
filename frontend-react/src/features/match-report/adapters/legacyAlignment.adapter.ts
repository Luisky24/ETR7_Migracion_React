/**
 * Carga bootstrap desde alineaciones legacy (Sheets/GAS).
 * Solo lectura — no persiste JSON ni muta repositorio documental.
 */

import { log } from '@/core/debug'
import { gasTransport } from '@/transport/gasTransport'
import type { LoadMatchReportResponse, MatchContext } from '../contracts'
import { adaptLoadMatchReportResponse } from './match-report.mapper'
import {
  legacyEncuentroFromContext,
  legacyEncuentroToArray,
} from './legacyEncuentro'

const GAS_OBTENER_ALINEACIONES = 'obtenerAlineacionesSPA'

export type LegacyAlignmentsWireFetcher = (context: MatchContext) => Promise<unknown>

function categoryToBackend(category: MatchContext['category']): string {
  return category === 'F' ? 'Femenina' : 'Masculina'
}

function phaseToBackend(phase: MatchContext['phase']): string {
  return phase === 'Fase II' ? 'Fase2' : 'Fase1'
}

/** Fetch wire `obtenerAlineacionesSPA` (boundary GAS). */
export async function fetchLegacyAlignmentsWire(context: MatchContext): Promise<unknown> {
  const encuentro = legacyEncuentroToArray(legacyEncuentroFromContext(context))
  const payload = [categoryToBackend(context.category), phaseToBackend(context.phase), encuentro]
  log.debug('legacyAlignment.fetch.start', { encuentroId: context.encuentroId })
  return gasTransport.call(GAS_OBTENER_ALINEACIONES, payload)
}

/** Adapta wire legacy → `LoadMatchReportResponse` (sin I/O). */
export function adaptLegacyAlignmentsToLoadResponse(
  context: MatchContext,
  raw: unknown,
): LoadMatchReportResponse {
  return adaptLoadMatchReportResponse(context, raw)
}

/**
 * Bootstrap legacy: alineaciones Sheets vía GAS.
 * El primer save JSON ocurre después, en repositorio documental.
 */
export async function loadLegacyAlignments(
  context: MatchContext,
  fetcher: LegacyAlignmentsWireFetcher = fetchLegacyAlignmentsWire,
): Promise<LoadMatchReportResponse> {
  const raw = await fetcher(context)
  const response = adaptLegacyAlignmentsToLoadResponse(context, raw)
  log.debug('legacyAlignment.load.ok', {
    encuentroId: context.encuentroId,
    fromActaSnapshot: response.fromActaSnapshot,
  })
  return response
}
