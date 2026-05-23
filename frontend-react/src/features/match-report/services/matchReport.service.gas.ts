/**
 * Integración GAS real: obtenerAlineacionesSPA, guardarActa, cerrarActaCompleta.
 */

import { log } from '@/core/debug'
import { gasTransport } from '@/transport/gasTransport'
import type {
  LoadMatchReportRequest,
  LoadMatchReportResponse,
  MatchClosureResult,
  MatchPersistenceDTO,
  MatchReport,
} from '../contracts'
import {
  adaptGasCloseResult,
  adaptGasSaveResult,
  adaptLoadMatchReportResponse,
  buildGasPayloadFromReport,
  mapGasErrorToClosureResult,
} from '../adapters/match-report.mapper'
import { legacyEncuentroFromContext, legacyEncuentroToArray } from '../adapters/legacyEncuentro'

const GAS_OBTENER_ALINEACIONES = 'obtenerAlineacionesSPA'
const GAS_GUARDAR_ACTA = 'guardarActa'
const GAS_CERRAR_ACTA = 'cerrarActaCompleta'

function categoryToBackend(category: 'M' | 'F'): string {
  return category === 'F' ? 'Femenina' : 'Masculina'
}

function phaseToBackend(phase: 'Fase I' | 'Fase II'): string {
  return phase === 'Fase II' ? 'Fase2' : 'Fase1'
}

export async function gasLoadMatchReport(
  request: LoadMatchReportRequest,
): Promise<LoadMatchReportResponse> {
  const { context } = request
  const encuentro = legacyEncuentroToArray(legacyEncuentroFromContext(context))
  const arrEncuentroActa = [categoryToBackend(context.category), phaseToBackend(context.phase), encuentro]

  log.debug('matchReport.gas.load.start', { encuentroId: context.encuentroId })

  try {
    const raw: unknown = await gasTransport.call(GAS_OBTENER_ALINEACIONES, arrEncuentroActa)
    const response = adaptLoadMatchReportResponse(context, raw ?? null)
    log.debug('matchReport.gas.load.done', {
      encuentroId: context.encuentroId,
      fromActaSnapshot: response.fromActaSnapshot,
      cerrada: response.cerrada,
    })
    return response
  } catch (e) {
    log.error('matchReport.gas.load.error', {
      encuentroId: context.encuentroId,
      message: e instanceof Error ? e.message : String(e),
    })
    throw e
  }
}

export async function gasSaveMatchReportDraft(
  dto: MatchPersistenceDTO,
  report: MatchReport,
): Promise<{ readonly ok: true; readonly report: MatchReport }> {
  const payload = buildGasPayloadFromReport({ ...dto, cerrar: false }, report)
  log.debug('matchReport.gas.saveDraft.start', { idEncuentro: dto.idEncuentro })

  try {
    const raw: unknown = await gasTransport.call(GAS_GUARDAR_ACTA, payload)
    return adaptGasSaveResult(raw, report)
  } catch (e) {
    log.error('matchReport.gas.saveDraft.error', {
      message: e instanceof Error ? e.message : String(e),
    })
    throw e
  }
}

export async function gasCloseMatchReport(
  dto: MatchPersistenceDTO,
  report: MatchReport,
): Promise<MatchClosureResult> {
  const payload = buildGasPayloadFromReport({ ...dto, cerrar: true }, report)
  log.debug('matchReport.gas.close.start', { idEncuentro: dto.idEncuentro })

  try {
    const raw: unknown = await gasTransport.call(GAS_CERRAR_ACTA, payload)
    return adaptGasCloseResult(raw, report)
  } catch (e) {
    log.error('matchReport.gas.close.error', {
      message: e instanceof Error ? e.message : String(e),
    })
    return mapGasErrorToClosureResult(e)
  }
}
