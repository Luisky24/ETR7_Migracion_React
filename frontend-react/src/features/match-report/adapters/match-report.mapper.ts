/**
 * Orquestación legacy → MatchReport / MatchPersistenceDTO → payload GAS.
 */

import type {
  LoadMatchReportResponse,
  MatchClosureResult,
  MatchContext,
  MatchPersistenceDTO,
  MatchReferee,
  MatchReport,
  PlayerMatchStatsWire,
} from '../contracts'
import type { MatchClosureErrorCode } from '../contracts/errors.contract'
import type {
  GasActaLoadMetadataWire,
  GasCerrarActaResult,
  GasGuardarActaPayload,
  GasGuardarActaResult,
  GasObtenerAlineacionesResponse,
} from '../contracts/matchReport.wire'
import { deriveEditability, recalculateMatchReport } from '../domain'
import { isValidMatchReportWire, isValidPersistenceResponse } from '../guards'
import { normalizedWireError } from '../utils/errorNormalizer'
import { normalizeRefereeName } from '../utils/referee'
import { mapGasTeamLineupToMatchTeam, teamWireHasActaStats } from './alignment.mapper'
import {
  legacyEncuentroFromContext,
  legacyEncuentroToArray,
  parseScoreFromResultadoDisplay,
} from './legacyEncuentro'

function str(v: unknown): string {
  return v != null ? String(v).trim() : ''
}

interface LoadWireMeta {
  readonly referee?: MatchReferee
  readonly incidencias?: string
  readonly observacionesLocal?: string
  readonly observacionesVisitante?: string
}

function parseLoadMetadata(meta: unknown): LoadWireMeta {
  if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return {}
  const o = meta as GasActaLoadMetadataWire
  const referee = normalizeRefereeName(str(o.arbitro))
  const incidencias = str(o.incidencias)
  const observacionesLocal = str(o.observacionesLocal)
  const observacionesVisitante = str(o.observacionesVisitante)
  return {
    referee,
    incidencias: incidencias || undefined,
    observacionesLocal: observacionesLocal || undefined,
    observacionesVisitante: observacionesVisitante || undefined,
  }
}

function resolveTeamsWire(raw: unknown): GasObtenerAlineacionesResponse {
  const arr = raw as readonly unknown[]
  return [arr[0], arr[1]] as GasObtenerAlineacionesResponse
}

function toWirePlayerStats(p: PlayerMatchStatsWire): Record<string, unknown> {
  return {
    jugador: p.jugador,
    dorsal: p.dorsal,
    E: p.E,
    T: p.T,
    PC: p.PC,
    Tar: p.Tar,
  }
}

/** Adapta respuesta de `obtenerAlineacionesSPA` a `LoadMatchReportResponse`. */
export function adaptLoadMatchReportResponse(
  context: MatchContext,
  raw: unknown,
): LoadMatchReportResponse {
  if (!isValidMatchReportWire(raw)) {
    throw new Error(normalizedWireError('WIRE_INCOMPLETE', 'LINEUPS_NOT_FOUND').technicalMessage)
  }

  const teams = resolveTeamsWire(raw)
  const meta = Array.isArray(raw) && raw.length >= 3 ? parseLoadMetadata(raw[2]) : {}
  const [wireLocal, wireVisit] = teams

  const local = mapGasTeamLineupToMatchTeam(wireLocal, 'local', context.equipoLocal)
  const visitante = mapGasTeamLineupToMatchTeam(wireVisit, 'visitante', context.equipoVisitante)
  if (!local || !visitante) {
    throw new Error(normalizedWireError('WIRE_INCOMPLETE', 'LINEUPS_NOT_FOUND').technicalMessage)
  }

  const fromActaSnapshot = teamWireHasActaStats(wireLocal) || teamWireHasActaStats(wireVisit)
  const cerrada = context.matchStatus === 'acta_cerrada'

  const score = fromActaSnapshot
    ? { local: 0, visitante: 0 }
    : parseScoreFromResultadoDisplay(context.resultadoDisplay)

  let report: MatchReport = {
    context,
    cerrada,
    fromActaSnapshot,
    modoBorrador: !cerrada,
    local,
    visitante,
    score,
    incidencias: '',
    editability: deriveEditability(context.matchStatus, cerrada),
  }

  report = recalculateMatchReport(report)

  if (!fromActaSnapshot && context.resultadoDisplay.trim()) {
    const parsed = parseScoreFromResultadoDisplay(context.resultadoDisplay)
    if (parsed.local > 0 || parsed.visitante > 0) {
      report = recalculateMatchReport(report, { scoreOverride: parsed })
    }
  }

  if (meta.incidencias !== undefined) {
    report = { ...report, incidencias: meta.incidencias }
  }
  if (meta.referee) {
    report = { ...report, referee: meta.referee }
  }
  if (meta.observacionesLocal !== undefined) {
    report = { ...report, local: { ...report.local, observaciones: meta.observacionesLocal } }
  }
  if (meta.observacionesVisitante !== undefined) {
    report = {
      ...report,
      visitante: { ...report.visitante, observaciones: meta.observacionesVisitante },
    }
  }

  return {
    report,
    cerrada,
    fromActaSnapshot,
  }
}

/** Payload GAS con encuentro completo desde contexto del informe (única salida wire). */
export function buildGasPayloadFromReport(
  dto: MatchPersistenceDTO,
  report: MatchReport,
): GasGuardarActaPayload {
  const encFields = legacyEncuentroFromContext(report.context)
  const resultadoStr = `${dto.resultadoLocal} - ${dto.resultadoVisitante}`
  return {
    categoria: dto.categoria,
    fase: dto.fase,
    encuentro: legacyEncuentroToArray({
      ...encFields,
      resultado: resultadoStr,
      estadoPartido: dto.cerrar ? 'acta_cerrada' : report.context.matchStatus,
      estadoAlineaciones: dto.cerrar ? 'F - F' : encFields.estadoAlineaciones,
    }),
    idEncuentro: dto.idEncuentro,
    referencia_encuentro: dto.referencia_encuentro,
    resultadoLocal: dto.resultadoLocal,
    resultadoVisitante: dto.resultadoVisitante,
    incidencias: dto.incidencias,
    ...(dto.referee?.name ? { arbitro: dto.referee.name } : {}),
    arrResultadoLocal: dto.arrResultadoLocal.map(toWirePlayerStats),
    arrResultadoVisitante: dto.arrResultadoVisitante.map(toWirePlayerStats),
    arrTotalesLocal: { ...dto.arrTotalesLocal },
    arrTotalesVisitante: { ...dto.arrTotalesVisitante },
    arrPuntosConseguidosLocal: { ...dto.arrPuntosConseguidosLocal },
    arrPuntosConseguidosVisitante: { ...dto.arrPuntosConseguidosVisitante },
    cerrar: dto.cerrar,
  }
}

function mapErrorMessageToCode(message: string): MatchClosureErrorCode {
  const m = message.toLowerCase()
  if (m.includes('referencia_encuentro') || m.includes('sin referencia')) {
    return 'MISSING_REFERENCIA_F2'
  }
  if (m.includes('alineacion') || m.includes('lineup')) {
    return 'LINEUPS_NOT_FOUND'
  }
  if (m.includes('empate') && m.includes('copa')) {
    return 'COPA_DRAW_NOT_ALLOWED'
  }
  if (m.includes('placeholder') || m.includes('ganador') || m.includes('perdedor')) {
    return 'COPA_PLACEHOLDER_NOT_FOUND'
  }
  if (m.includes('acta') && m.includes('incomplet')) {
    return 'ACTA_NOT_FOUND'
  }
  return 'SERVER_ERROR'
}

export function mapGasErrorToClosureResult(error: unknown): MatchClosureResult {
  const message = error instanceof Error ? error.message : String(error)
  return {
    ok: false,
    cerrada: false,
    errorCode: mapErrorMessageToCode(message),
    message,
  }
}

export function adaptGasSaveResult(
  raw: unknown,
  report: MatchReport,
): { readonly ok: true; readonly report: MatchReport } {
  if (!isValidPersistenceResponse(raw)) {
    throw new Error(normalizedWireError('WIRE_INVALID').technicalMessage)
  }
  const body = raw as GasGuardarActaResult
  if (body.ok === false) {
    throw new Error('Error al guardar el acta en el servidor.')
  }
  const recalculated = recalculateMatchReport(report)
  return { ok: true, report: recalculated }
}

export function adaptGasCloseResult(raw: unknown, report: MatchReport): MatchClosureResult {
  const body = (isValidPersistenceResponse(raw) ? raw : {}) as GasCerrarActaResult
  if (!body.ok) {
    return {
      ok: false,
      cerrada: false,
      errorCode: 'SERVER_ERROR',
      message: 'El servidor no confirmó el cierre del acta.',
    }
  }

  const closedReport = recalculateMatchReport({
    ...report,
    cerrada: true,
    editability: 'read_only',
    context: {
      ...report.context,
      matchStatus: 'acta_cerrada',
      resultadoDisplay: `${report.score.local} - ${report.score.visitante}`,
      estadoAlineacionesDisplay: 'F - F',
    },
  })

  return {
    ok: true,
    cerrada: !!body.cerrada,
    perf: body.perf,
    serverClassification: {
      local: closedReport.local.classification,
      visitante: closedReport.visitante.classification,
    },
  }
}
