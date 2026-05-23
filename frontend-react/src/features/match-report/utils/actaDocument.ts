import type { ActaDocumentV1LegacyFlat, MatchPersistenceDTO, MatchReport } from '../contracts'

/** Proyección DTO → documento JSON plano legacy (sin I/O). */
export function buildActaDocumentV1(dto: MatchPersistenceDTO, report: MatchReport): ActaDocumentV1LegacyFlat {
  return {
    version: 1,
    categoria: dto.categoria,
    fase: dto.fase,
    idEncuentro: dto.idEncuentro,
    referencia_encuentro: dto.referencia_encuentro,
    resultadoLocal: dto.resultadoLocal,
    resultadoVisitante: dto.resultadoVisitante,
    incidencias: dto.incidencias,
    referee: dto.referee,
    observacionesLocal: dto.observacionesLocal,
    observacionesVisitante: dto.observacionesVisitante,
    arrResultadoLocal: dto.arrResultadoLocal,
    arrResultadoVisitante: dto.arrResultadoVisitante,
    arrTotalesLocal: dto.arrTotalesLocal,
    arrTotalesVisitante: dto.arrTotalesVisitante,
    cerrada: report.cerrada,
  }
}
