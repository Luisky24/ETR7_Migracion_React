/**
 * Encapsula la tupla `encuentro[]` legacy — único módulo con índices posicionales.
 */

import type { MatchContext } from '../contracts'
import type { LegacyEncuentroFields } from '../contracts/matchReport.wire'

const IDX = {
  grupo: 0,
  equipoLocal: 1,
  equipoVisitante: 2,
  hora: 3,
  campo: 4,
  resultado: 5,
  estadoAlineaciones: 6,
  estadoPartido: 7,
  referenciaEncuentro: 8,
} as const

function strAt(row: readonly unknown[], index: number): string {
  const v = row[index]
  return v != null ? String(v).trim() : ''
}

export function legacyEncuentroFromContext(context: MatchContext): LegacyEncuentroFields {
  return {
    grupo: context.grupo,
    equipoLocal: context.equipoLocal,
    equipoVisitante: context.equipoVisitante,
    hora: context.hora,
    campo: context.campo,
    resultado: context.resultadoDisplay,
    estadoAlineaciones: context.estadoAlineacionesDisplay,
    estadoPartido: context.matchStatus,
    referenciaEncuentro: context.referenciaEncuentro,
  }
}

export function legacyEncuentroToArray(fields: LegacyEncuentroFields): readonly string[] {
  const row: string[] = []
  row[IDX.grupo] = fields.grupo
  row[IDX.equipoLocal] = fields.equipoLocal
  row[IDX.equipoVisitante] = fields.equipoVisitante
  row[IDX.hora] = fields.hora
  row[IDX.campo] = fields.campo
  row[IDX.resultado] = fields.resultado
  row[IDX.estadoAlineaciones] = fields.estadoAlineaciones
  row[IDX.estadoPartido] = fields.estadoPartido
  row[IDX.referenciaEncuentro] = fields.referenciaEncuentro
  return row
}

export function parseLegacyEncuentroArray(raw: unknown): LegacyEncuentroFields | null {
  if (!Array.isArray(raw) || raw.length < 3) return null
  return {
    grupo: strAt(raw, IDX.grupo),
    equipoLocal: strAt(raw, IDX.equipoLocal),
    equipoVisitante: strAt(raw, IDX.equipoVisitante),
    hora: strAt(raw, IDX.hora),
    campo: strAt(raw, IDX.campo),
    resultado: strAt(raw, IDX.resultado),
    estadoAlineaciones: strAt(raw, IDX.estadoAlineaciones),
    estadoPartido: strAt(raw, IDX.estadoPartido),
    referenciaEncuentro: strAt(raw, IDX.referenciaEncuentro),
  }
}

export function parseScoreFromResultadoDisplay(resultado: string): { local: number; visitante: number } {
  const trimmed = resultado.trim()
  if (!trimmed) return { local: 0, visitante: 0 }
  const partes = trimmed.split(/-|–|—/)
  if (partes.length < 2) return { local: 0, visitante: 0 }
  const local = parseInt(String(partes[0]).trim(), 10)
  const visitante = parseInt(String(partes[1]).trim(), 10)
  return {
    local: Number.isFinite(local) ? local : 0,
    visitante: Number.isFinite(visitante) ? visitante : 0,
  }
}
