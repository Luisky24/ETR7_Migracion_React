import { log } from '@/core/debug'
import type {
  TeamLineupContextDto,
  TeamLineupContextFlagsDto,
  TeamLineupContextMetadataDto,
  TeamLineupContextResponse,
  TeamLineupContextWire,
  TeamLineupPermissionsDto,
  TeamLineupPlayerDto,
  TeamLineupSaveSuccessBody,
  TeamLineupSaveWire,
  TeamLineupWorkflowStateDto,
} from '../contracts/teamLineupContext.contract'

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === 'object' && !Array.isArray(x)
}

function str(v: unknown): string {
  return v != null ? String(v) : ''
}

function strOrNull(v: unknown): string | null {
  const s = str(v).trim()
  return s === '' ? null : s
}

function numOrStringOrNull(v: unknown): number | string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return str(v)
}

function parsePlayer(o: unknown): TeamLineupPlayerDto | null {
  if (!isRecord(o)) return null
  const nombre = str(o.nombre).trim()
  if (!nombre) return null
  const dorsalRaw = o.dorsal
  let dorsal: number | null = null
  if (typeof dorsalRaw === 'number' && Number.isFinite(dorsalRaw) && dorsalRaw > 0) {
    dorsal = dorsalRaw
  } else if (typeof dorsalRaw === 'string' && dorsalRaw.trim() !== '') {
    const n = parseInt(dorsalRaw, 10)
    if (!Number.isNaN(n) && n > 0) dorsal = n
  }
  return {
    nombre,
    titular: o.titular === true,
    suplente: o.suplente === true,
    capitan: o.capitan === true,
    dorsal,
  }
}

function parsePermissions(o: unknown): TeamLineupPermissionsDto | null {
  if (!isRecord(o)) return null
  const reasonCodes = o.reasonCodes
  const rc = Array.isArray(reasonCodes) ? reasonCodes.map((x) => str(x)) : []
  return {
    canRead: o.canRead === true,
    canEdit: o.canEdit === true,
    canConfirm: o.canConfirm === true,
    canSelectTeam: o.canSelectTeam === true,
    protectedMode: o.protectedMode === true,
    reasonCodes: rc,
  }
}

function parseWorkflow(o: unknown): TeamLineupWorkflowStateDto | null {
  if (!isRecord(o)) return null
  const allowed = new Set(['P', 'E', 'C', 'F', 'EMPTY'])
  const ts = str(o.teamSlotState).toUpperCase()
  const os = str(o.opponentSlotState).toUpperCase()
  return {
    teamSlotState: allowed.has(ts) ? (ts as TeamLineupWorkflowStateDto['teamSlotState']) : 'EMPTY',
    opponentSlotState: allowed.has(os) ? (os as TeamLineupWorkflowStateDto['opponentSlotState']) : 'EMPTY',
    matchState: parseMatchState(o.matchState),
    sheetStateEnc: strOrNull(o.sheetStateEnc),
  }
}

function parseMatchState(v: unknown): TeamLineupWorkflowStateDto['matchState'] {
  const s = str(v).trim()
  const ok = new Set([
    'sin_alineacion',
    'alineacion_parcial',
    'acta_abierta',
    'acta_cerrada',
    'unspecified',
  ])
  return ok.has(s) ? (s as TeamLineupWorkflowStateDto['matchState']) : 'unspecified'
}

function parseFlags(o: unknown): TeamLineupContextFlagsDto | null {
  if (!isRecord(o)) return null
  return {
    fromActaSnapshot: o.fromActaSnapshot === true,
    cerradaPorActa: o.cerradaPorActa === true,
    staleRiskEncVsCalendar: o.staleRiskEncVsCalendar === true,
  }
}

function parseMetadata(o: unknown): TeamLineupContextMetadataDto | null {
  if (!isRecord(o)) return null
  return {
    version: typeof o.version === 'number' ? o.version : 2,
    serverTime: str(o.serverTime),
    etag: o.etag == null ? null : str(o.etag),
  }
}

function parseMatchRef(o: unknown): TeamLineupContextDto['match'] | null {
  if (!isRecord(o)) return null
  const el = str(o.equipoLocal).trim()
  const ev = str(o.equipoVisitante).trim()
  if (!el || !ev) return null
  return {
    categoria: str(o.categoria),
    fase: str(o.fase),
    grupo: str(o.grupo),
    equipoLocal: el,
    equipoVisitante: ev,
    encuentroLabel: str(o.encuentroLabel),
    hora: strOrNull(o.hora),
    campo: strOrNull(o.campo),
    referenciaEncuentro: strOrNull(o.referenciaEncuentro),
    numFilaCalendario: numOrStringOrNull(o.numFilaCalendario),
  }
}

function parseContext(o: unknown): TeamLineupContextDto | null {
  if (!isRecord(o)) return null
  const match = parseMatchRef(o.match)
  if (!match) return null
  const ind = str(o.indLocalVisitante).toUpperCase()
  if (ind !== 'L' && ind !== 'V') return null
  const jugs = o.jugadores
  const jugadores: TeamLineupPlayerDto[] = []
  if (Array.isArray(jugs)) {
    for (const j of jugs) {
      const p = parsePlayer(j)
      if (p) jugadores.push(p)
    }
  }
  const na = o.nivelAcceso
  const nivelAcceso = typeof na === 'number' && Number.isFinite(na) ? na : parseInt(str(na), 10)
  return {
    match,
    equipoOperativo: str(o.equipoOperativo).trim(),
    indLocalVisitante: ind,
    contrario: str(o.contrario),
    delegado: str(o.delegado),
    entrenador: str(o.entrenador),
    jugadores,
    nivelAcceso: Number.isNaN(nivelAcceso) ? 0 : nivelAcceso,
    role: str(o.role),
    origenModelo: str(o.origenModelo),
  }
}

/**
 * Adapta la respuesta cruda de `alineaciones_getTeamLineupContext_v2`.
 */
export function adaptTeamLineupContextWire(raw: unknown): TeamLineupContextWire | null {
  if (!isRecord(raw)) {
    log.warn('teamLineupContext.adapter.unexpected', { reason: 'not_object' })
    return null
  }
  const meta = parseMetadata(raw.metadata)
  if (!meta) {
    log.warn('teamLineupContext.adapter.unexpected', { reason: 'bad_metadata' })
    return null
  }
  if (raw.ok === false) {
    const err = raw.error
    if (!isRecord(err)) return null
    return {
      ok: false,
      error: { code: str(err.code) || 'UNKNOWN', message: str(err.message) || 'Error' },
      metadata: meta,
    }
  }
  if (raw.ok !== true) {
    log.warn('teamLineupContext.adapter.unexpected', { reason: 'ok_not_true' })
    return null
  }
  const context = parseContext(raw.context)
  const permissions = parsePermissions(raw.permissions)
  const workflow = parseWorkflow(raw.workflow)
  const flags = parseFlags(raw.flags)
  if (!context || !permissions || !workflow || !flags) {
    log.warn('teamLineupContext.adapter.unexpected', { reason: 'incomplete_success_body' })
    return null
  }
  const out: TeamLineupContextResponse = {
    ok: true,
    context,
    permissions,
    workflow,
    flags,
    metadata: meta,
  }
  return out
}

/**
 * Respuesta `alineaciones_saveTeamLineup_v2` / `alineaciones_confirmTeamLineup_v2` (ok + metadata o error).
 */
export function adaptTeamLineupSaveWire(raw: unknown): TeamLineupSaveWire | null {
  if (!isRecord(raw)) {
    log.warn('teamLineupSave.adapter.unexpected', { reason: 'not_object' })
    return null
  }
  const meta = parseMetadata(raw.metadata)
  if (!meta) {
    log.warn('teamLineupSave.adapter.unexpected', { reason: 'bad_metadata' })
    return null
  }
  if (raw.ok === false) {
    const err = raw.error
    if (!isRecord(err)) return null
    return {
      ok: false,
      error: { code: str(err.code) || 'UNKNOWN', message: str(err.message) || 'Error' },
      metadata: meta,
    }
  }
  if (raw.ok !== true) {
    log.warn('teamLineupSave.adapter.unexpected', { reason: 'ok_not_true' })
    return null
  }
  const out: TeamLineupSaveSuccessBody = {
    ok: true,
    metadata: meta,
  }
  return out
}
