/**
 * Validación pura del agregado EncounterWorkspaceDocumentV1.
 * Sin I/O, sin runtime React, sin persistencia acta actual.
 */

import {
  AUDIT_EVENTS_MAX_ENTRIES,
  ENCOUNTER_WORKSPACE_SCHEMA_VERSION,
  SYNC_LEDGER_MAX_ENTRIES,
  type AlignmentGate,
  type AlignmentTeamEstado,
  type CalendarSyncIntent,
  type EncounterWorkspaceDocumentV1,
  type TeamAlignmentDocumentV1,
  type WorkspaceActaSectionV1,
  type WorkspaceAlignmentsSectionV1,
  type WorkspaceAuditKind,
  type WorkspaceLifecyclePhase,
} from './encounter-workspace.document'
import type { InvariantCategory, InvariantSeverity } from './encounter-workspace.invariants'

export interface WorkspaceValidationIssue {
  readonly invariantId: string
  readonly code: string
  readonly message: string
  readonly severity: InvariantSeverity
  readonly category: InvariantCategory
}

export interface WorkspaceValidationResult {
  readonly ok: boolean
  readonly issues: readonly WorkspaceValidationIssue[]
  readonly derivedLifecycle: WorkspaceLifecyclePhase
  readonly derivedAlignmentGate: AlignmentGate
}

export interface ValidateEncounterWorkspaceOptions {
  readonly expectedMatchId?: string
  /** Simula intento de mutación para WS-30 / WS-9. */
  readonly editIntent?: 'save_draft' | 'close' | 'read'
  /** WS-16: exige alignmentAcceptance para coherencia de materialización. Default true. */
  readonly strictMaterializePolicy?: boolean
}

const CRITICAL_AUDIT_KINDS: readonly WorkspaceAuditKind[] = [
  'WORKSPACE_CREATE',
  'ACTA_CLOSED',
  'ACTA_REOPENED',
  'ALIGNMENTS_REOPENED',
]

const PROHIBITED_ROOT_KEYS = [
  'legacy',
  'sheet',
  'bootstrap',
  'matchStatus',
  'actaRevisions',
  'operationalActas',
] as const

function issue(
  invariantId: string,
  code: string,
  message: string,
  category: InvariantCategory,
  severity: InvariantSeverity = 'error',
): WorkspaceValidationIssue {
  return { invariantId, code, message, severity, category }
}

function isIso8601(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}

function isNonEmptyString(value: string | undefined): value is string {
  return value != null && value.trim().length > 0
}

export function buildCalendarSyncKeyString(
  matchId: string,
  workspaceVersion: number,
  intent: CalendarSyncIntent,
): string {
  return `${matchId}::v${workspaceVersion}::${intent}`
}

/** Única representación de gate (WS-41, WS-42). */
export function deriveAlignmentGate(alignments: WorkspaceAlignmentsSectionV1): AlignmentGate {
  const l = alignments.local.estado
  const v = alignments.visitante.estado
  if (l === '' && v === '') return 'not_started'
  if (l === 'C' && v === 'C') return 'both_closed'
  return 'in_progress'
}

/** Derivación formal de lifecycle.phase (WS-31). */
export function deriveWorkspaceLifecyclePhase(
  doc: EncounterWorkspaceDocumentV1,
): WorkspaceLifecyclePhase {
  if (doc.acta?.status === 'ACTA_CERRADA') return 'acta_closed'
  if (doc.acta?.status === 'ACTA_EN_CURSO') return 'acta_in_progress'
  const gate = deriveAlignmentGate(doc.alignments)
  if (gate === 'both_closed') return 'alignment_complete'
  if (gate === 'in_progress') return 'alignment_in_progress'
  return 'workspace_created'
}

function officialsIsEmpty(officials: EncounterWorkspaceDocumentV1['officials']): boolean {
  if (!officials.referee) return true
  return !isNonEmptyString(officials.referee.name)
}

function validateIdentity(doc: EncounterWorkspaceDocumentV1): WorkspaceValidationIssue[] {
  const issues: WorkspaceValidationIssue[] = []
  const { identity } = doc
  const expectedKey = `${identity.category}::${identity.phase}::${identity.matchId}`

  if (identity.storageKey !== expectedKey) {
    issues.push(
      issue('WS-2', 'STORAGE_KEY_MISMATCH', `storageKey esperado ${expectedKey}`, 'identity'),
    )
  }

  if (!Number.isInteger(identity.encounter.encounterNumber) || identity.encounter.encounterNumber < 1) {
    issues.push(
      issue('WS-3', 'ENCOUNTER_NUMBER_INVALID', 'encounterNumber debe ser entero >= 1', 'identity'),
    )
  }

  const enc = identity.encounter
  const row = doc.calendarRef.rowKey
  if (
    row.grupo !== enc.grupo ||
    row.equipoLocal !== enc.equipoLocal ||
    row.equipoVisitante !== enc.equipoVisitante
  ) {
    issues.push(
      issue(
        'WS-4',
        'CALENDAR_ROW_KEY_MISMATCH',
        'calendarRef.rowKey no coincide con identity.encounter',
        'identity',
      ),
    )
  }

  if (
    (enc.referenciaEncuentro ?? undefined) !== (row.referenciaEncuentro ?? undefined) &&
    isNonEmptyString(enc.referenciaEncuentro) &&
    isNonEmptyString(row.referenciaEncuentro) &&
    enc.referenciaEncuentro !== row.referenciaEncuentro
  ) {
    issues.push(
      issue('WS-32', 'REFERENCIA_MISMATCH', 'referenciaEncuentro divergente en rowKey', 'identity'),
    )
  }

  return issues
}

function validateAlignmentTeam(
  team: TeamAlignmentDocumentV1,
  expectedEquipo: string,
  side: string,
): WorkspaceValidationIssue[] {
  const issues: WorkspaceValidationIssue[] = []
  if (team.equipo !== expectedEquipo) {
    issues.push(
      issue(
        'WS-15',
        'ALIGNMENT_EQUIPO_MISMATCH',
        `alignments.${side}.equipo no coincide con identity.encounter`,
        'alignments',
      ),
    )
  }

  const dorsals = new Set<number>()
  let captains = 0
  for (const p of team.players) {
    if (p.dorsal < 1 || p.dorsal > 99) {
      issues.push(
        issue('WS-13', 'DORSAL_OUT_OF_RANGE', `Dorsal inválido en ${side}: ${p.dorsal}`, 'alignments'),
      )
    }
    if (dorsals.has(p.dorsal)) {
      issues.push(
        issue('WS-13', 'DORSAL_DUPLICATE', `Dorsal duplicado en ${side}: ${p.dorsal}`, 'alignments'),
      )
    }
    dorsals.add(p.dorsal)
    if (p.capitan) {
      captains += 1
      if (!p.titular) {
        issues.push(
          issue('WS-14', 'CAPTAIN_NOT_TITULAR', `Capitán no titular en ${side}`, 'alignments'),
        )
      }
    }
  }
  if (captains > 1) {
    issues.push(issue('WS-14', 'MULTIPLE_CAPTAINS', `Múltiples capitanes en ${side}`, 'alignments'))
  }

  const validEstado: AlignmentTeamEstado[] = ['', 'P', 'C']
  if (!validEstado.includes(team.estado)) {
    issues.push(issue('WS-42', 'ALIGNMENT_ESTADO_INVALID', `estado inválido en ${side}`, 'alignments'))
  }

  return issues
}

function validateAlignments(doc: EncounterWorkspaceDocumentV1): WorkspaceValidationIssue[] {
  const issues: WorkspaceValidationIssue[] = []
  const { alignments, identity } = doc

  if (alignments.schemaVersion !== 1) {
    issues.push(issue('WS-41', 'ALIGNMENTS_SCHEMA', 'alignments.schemaVersion debe ser 1', 'alignments'))
  }

  const derivedGate = deriveAlignmentGate(alignments)
  if (alignments.gate !== derivedGate) {
    issues.push(
      issue(
        'WS-42',
        'ALIGNMENT_GATE_MISMATCH',
        `alignments.gate=${alignments.gate} pero derivado=${derivedGate}`,
        'alignments',
      ),
    )
  }

  issues.push(
    ...validateAlignmentTeam(alignments.local, identity.encounter.equipoLocal, 'local'),
    ...validateAlignmentTeam(alignments.visitante, identity.encounter.equipoVisitante, 'visitante'),
  )

  if (doc.lifecycle.phase === 'acta_closed' && doc.workflow.actaBinding === 'ACTIVE') {
    if (derivedGate !== 'both_closed') {
      issues.push(
        issue(
          'WS-34',
          'ALIGNMENTS_NOT_FROZEN',
          'acta cerrada con binding ACTIVE requiere alignments.gate both_closed',
          'alignments',
        ),
      )
    }
    if (alignments.local.estado !== 'C' || alignments.visitante.estado !== 'C') {
      issues.push(
        issue(
          'WS-34',
          'ALIGNMENT_ESTADO_NOT_FROZEN',
          'acta cerrada: ambos equipos deben estar en estado C',
          'alignments',
        ),
      )
    }
  }

  return issues
}

function validateActaSection(acta: WorkspaceActaSectionV1): WorkspaceValidationIssue[] {
  const issues: WorkspaceValidationIssue[] = []

  const sumTeam = (players: WorkspaceActaSectionV1['localTeam']['players']) =>
    players.reduce(
      (acc, p) => ({
        E: acc.E + p.E,
        T: acc.T + p.T,
        PC: acc.PC + p.PC,
        Tar: acc.Tar + p.Tar,
      }),
      { E: 0, T: 0, PC: 0, Tar: 0 },
    )

  for (const [label, team] of [
    ['local', acta.localTeam],
    ['visitante', acta.awayTeam],
  ] as const) {
    const sum = sumTeam(team.players)
    const t = team.totals
    if (sum.E !== t.E || sum.T !== t.T || sum.PC !== t.PC || sum.Tar !== t.Tar) {
      issues.push(
        issue(
          'WS-17',
          'TOTALS_PLAYER_MISMATCH',
          `Totales acta ${label} incoherentes con jugadores`,
          'acta',
        ),
      )
    }
  }

  for (const [label, c] of [
    ['local', acta.classification.local],
    ['visitante', acta.classification.visitante],
  ] as const) {
    const expected = c.P + c.BO + c.BD
    if (Math.abs(expected - c.Total) > 1e-6) {
      issues.push(
        issue(
          'WS-17',
          'CLASSIFICATION_TOTAL_MISMATCH',
          `Classification ${label} incoherente`,
          'acta',
        ),
      )
    }
  }

  if (acta.status === 'ACTA_EN_CURSO' && acta.classification.official) {
    issues.push(
      issue(
        'WS-18',
        'OFFICIAL_BEFORE_CLOSE',
        'classification.official no permitido con acta en curso',
        'acta',
      ),
    )
  }

  if (acta.status === 'ACTA_CERRADA' && !acta.closedAt) {
    issues.push(issue('WS-19', 'CLOSED_AT_MISSING', 'acta cerrada sin closedAt', 'acta'))
  }

  return issues
}

function validateWorkflowAndActa(
  doc: EncounterWorkspaceDocumentV1,
  options: ValidateEncounterWorkspaceOptions,
): WorkspaceValidationIssue[] {
  const issues: WorkspaceValidationIssue[] = []
  const { workflow, acta } = doc

  if (workflow.alignmentAcceptance && deriveAlignmentGate(doc.alignments) !== 'both_closed') {
    issues.push(
      issue(
        'WS-28',
        'ACCEPTANCE_WITHOUT_BOTH_CLOSED',
        'alignmentAcceptance requiere alignments.gate both_closed',
        'workflow',
      ),
    )
  }

  if (workflow.actaBinding === 'SUPERSEDED' && workflow.alignmentAcceptance) {
    issues.push(
      issue(
        'WS-29',
        'ACCEPTANCE_WITH_SUPERSEDED',
        'SUPERSEDED incompatible con alignmentAcceptance activa',
        'workflow',
      ),
    )
  }

  if (workflow.lastReopen?.mode === 'REOPEN_ALIGNMENTS' && workflow.actaBinding !== 'SUPERSEDED') {
    issues.push(
      issue(
        'WS-10',
        'REOPEN_ALIGNMENTS_BINDING',
        'REOPEN_ALIGNMENTS requiere actaBinding SUPERSEDED',
        'workflow',
      ),
    )
  }

  if (workflow.lastReopen?.mode === 'REOPEN_ACTA' && workflow.actaBinding === 'SUPERSEDED') {
    issues.push(
      issue(
        'WS-11',
        'REOPEN_ACTA_SUPERSEDED',
        'REOPEN_ACTA incompatible con actaBinding SUPERSEDED',
        'workflow',
      ),
    )
  }

  if (acta && workflow.actaBinding === 'SUPERSEDED' && acta.status === 'ACTA_EN_CURSO') {
    issues.push(
      issue(
        'WS-6',
        'SUPERSEDED_ACTA_EN_CURSO',
        'SUPERSEDED no puede coexistir con acta ACTA_EN_CURSO',
        'acta',
      ),
    )
  }

  if (acta === null && workflow.lastReopen?.mode === 'REOPEN_ACTA') {
    issues.push(
      issue('WS-5', 'REOPEN_ACTA_WITHOUT_ACTA', 'REOPEN_ACTA sin sección acta', 'acta'),
    )
  }

  const strictMaterialize = options.strictMaterializePolicy !== false
  if (
    strictMaterialize &&
    acta != null &&
    doc.lifecycle.phase === 'acta_in_progress' &&
    !workflow.alignmentAcceptance &&
    deriveAlignmentGate(doc.alignments) === 'both_closed'
  ) {
    issues.push(
      issue(
        'WS-16',
        'MATERIALIZE_WITHOUT_ACCEPTANCE',
        'acta materializada sin workflow.alignmentAcceptance (política estricta)',
        'alignments',
      ),
    )
  }

  const editIntent = options.editIntent
  if (editIntent === 'save_draft' || editIntent === 'close') {
    if (workflow.actaBinding === 'SUPERSEDED') {
      issues.push(
        issue(
          'WS-30',
          'EDIT_WHILE_SUPERSEDED',
          'PROHIBIDO save/close acta con actaBinding SUPERSEDED',
          'workflow',
        ),
      )
    }
    if (workflow.actaBinding !== 'ACTIVE') {
      issues.push(
        issue('WS-9', 'EDIT_BINDING_NOT_ACTIVE', 'save/close requiere actaBinding ACTIVE', 'workflow'),
      )
    }
    if (!acta) {
      issues.push(issue('WS-5', 'EDIT_WITHOUT_ACTA', 'save/close requiere acta materializada', 'acta'))
    } else if (editIntent === 'save_draft' && acta.status === 'ACTA_CERRADA') {
      issues.push(
        issue('WS-19', 'DRAFT_ON_CLOSED', 'PROHIBIDO save_draft con acta cerrada', 'acta'),
      )
    } else if (editIntent === 'close' && acta.status !== 'ACTA_EN_CURSO') {
      issues.push(
        issue('WS-19', 'CLOSE_NOT_EN_CURSO', 'close requiere acta ACTA_EN_CURSO', 'acta'),
      )
    }
  }

  return issues
}

function validateSync(doc: EncounterWorkspaceDocumentV1): WorkspaceValidationIssue[] {
  const issues: WorkspaceValidationIssue[] = []
  const { sync, metadata, identity, acta, workflow } = doc

  if (sync.ledger.length > SYNC_LEDGER_MAX_ENTRIES) {
    issues.push(
      issue(
        'WS-35',
        'LEDGER_OVERFLOW',
        `sync.ledger supera máximo ${SYNC_LEDGER_MAX_ENTRIES}`,
        'sync',
      ),
    )
  }

  const seenKeys = new Set<string>()
  let prevUpdatedAt: number | null = null
  for (let i = 0; i < sync.ledger.length; i += 1) {
    const entry = sync.ledger[i]
    if (!entry) continue

    const expectedString = buildCalendarSyncKeyString(
      entry.syncKey.matchId,
      entry.syncKey.workspaceVersion,
      entry.syncKey.intent,
    )
    if (entry.syncKeyString !== expectedString) {
      issues.push(
        issue(
          'WS-20',
          'SYNC_KEY_STRING_MISMATCH',
          `ledger[${i}] syncKeyString incoherente`,
          'sync',
        ),
      )
    }

    if (seenKeys.has(entry.syncKeyString)) {
      issues.push(
        issue(
          'WS-20',
          'SYNC_KEY_DUPLICATE',
          `syncKeyString duplicada: ${entry.syncKeyString}`,
          'sync',
        ),
      )
    }
    seenKeys.add(entry.syncKeyString)

    if (entry.syncKey.matchId !== identity.matchId) {
      issues.push(issue('WS-20', 'SYNC_KEY_MATCH_ID', 'syncKey.matchId diverge', 'sync'))
    }

    if (!isIso8601(entry.createdAt) || !isIso8601(entry.updatedAt)) {
      issues.push(
        issue('WS-39', 'LEDGER_TIMESTAMP_INVALID', `ledger[${i}] timestamps inválidos`, 'sync', 'warning'),
      )
    }

    const updatedMs = Date.parse(entry.updatedAt)
    if (prevUpdatedAt != null && updatedMs < prevUpdatedAt) {
      issues.push(
        issue(
          'WS-37',
          'LEDGER_NOT_APPEND_ORDER',
          'sync.ledger: updatedAt no monotónico (append-only)',
          'sync',
        ),
      )
    }
    prevUpdatedAt = updatedMs

    if (entry.intent === 'close') {
      if (acta?.status !== 'ACTA_CERRADA') {
        issues.push(
          issue('WS-21', 'CLOSE_LEDGER_LIFECYCLE', 'ledger close sin acta ACTA_CERRADA', 'sync'),
        )
      }
      if (workflow.actaBinding === 'SUPERSEDED') {
        issues.push(
          issue('WS-21', 'CLOSE_LEDGER_SUPERSEDED', 'ledger close con SUPERSEDED', 'sync'),
        )
      }
    }
  }

  const closeEntries = sync.ledger.filter((e) => e.intent === 'close')
  const draftWouldClose = metadata.lastMutationKind === 'ACTA_SAVE_DRAFT'
  if (draftWouldClose && closeEntries.some((e) => e.status === 'SUCCESS' && e.syncKey.workspaceVersion === metadata.workspaceVersion)) {
    issues.push(issue('WS-22', 'DRAFT_WITH_CLOSE_LEDGER', 'draft no debe registrar close exitoso misma versión', 'sync'))
  }

  if (sync.lastSuccessful) {
    const lastOk = sync.ledger.filter((e) => e.status === 'SUCCESS').at(-1)
    if (lastOk && lastOk.syncKeyString !== sync.lastSuccessful.syncKeyString) {
      issues.push(
        issue(
          'WS-39',
          'LAST_SUCCESSFUL_STALE',
          'sync.lastSuccessful no coincide con último SUCCESS del ledger',
          'sync',
          'warning',
        ),
      )
    }
  }

  return issues
}

function validateAudit(doc: EncounterWorkspaceDocumentV1): WorkspaceValidationIssue[] {
  const issues: WorkspaceValidationIssue[] = []
  const { audit } = doc

  if (audit.events.length > AUDIT_EVENTS_MAX_ENTRIES) {
    issues.push(
      issue(
        'WS-35',
        'AUDIT_OVERFLOW',
        `audit.events supera máximo ${AUDIT_EVENTS_MAX_ENTRIES}`,
        'audit',
      ),
    )
  }

  let prevAt: number | null = null
  for (let i = 0; i < audit.events.length; i += 1) {
    const ev = audit.events[i]
    if (!ev) continue
    const atMs = Date.parse(ev.at)
    if (!isIso8601(ev.at)) {
      issues.push(issue('WS-39', 'AUDIT_TIMESTAMP_INVALID', `audit.events[${i}] at inválido`, 'audit', 'warning'))
    }
    if (prevAt != null && atMs < prevAt) {
      issues.push(
        issue('WS-37', 'AUDIT_NOT_APPEND_ORDER', 'audit.events: at no monotónico', 'audit'),
      )
    }
    prevAt = atMs
  }

  if (audit.events.length === AUDIT_EVENTS_MAX_ENTRIES) {
    const criticalIndexes = audit.events
      .map((e, idx) => (CRITICAL_AUDIT_KINDS.includes(e.kind) ? idx : -1))
      .filter((idx) => idx >= 0)
    const oldestCritical = criticalIndexes[0]
    if (oldestCritical != null && oldestCritical < audit.events.length - 10) {
      issues.push(
        issue(
          'WS-39',
          'AUDIT_CRITICAL_TRUNCATED',
          'eventos críticos podrían quedar fuera de ventana reciente',
          'audit',
          'warning',
        ),
      )
    }
  }

  return issues
}

function detectProhibitedKeys(value: unknown, path = ''): WorkspaceValidationIssue[] {
  if (value == null || typeof value !== 'object') return []
  const issues: WorkspaceValidationIssue[] = []
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      issues.push(...detectProhibitedKeys(item, `${path}[${i}]`))
    })
    return issues
  }
  const record = value as Record<string, unknown>
  for (const key of Object.keys(record)) {
    const lower = key.toLowerCase()
    if (PROHIBITED_ROOT_KEYS.some((p) => lower.includes(p))) {
      issues.push(
        issue(
          'WS-25',
          'PROHIBITED_FIELD',
          `Campo prohibido en ${path || 'root'}: ${key}`,
          'prohibition',
        ),
      )
    }
    if (key === 'acta' && Array.isArray(record[key])) {
      issues.push(
        issue('WS-40', 'MULTIPLE_ACTAS', 'PROHIBIDO acta como array', 'prohibition'),
      )
    }
    if (key === 'alignmentGate' && path.includes('lifecycle')) {
      issues.push(
        issue('WS-41', 'LIFECYCLE_ALIGNMENT_GATE', 'PROHIBIDO lifecycle.alignmentGate', 'alignments'),
      )
    }
    const nextPath = path ? `${path}.${key}` : key
    issues.push(...detectProhibitedKeys(record[key], nextPath))
  }
  return issues
}

export function validateEncounterWorkspaceDocument(
  doc: EncounterWorkspaceDocumentV1,
  options: ValidateEncounterWorkspaceOptions = {},
): WorkspaceValidationResult {
  const issues: WorkspaceValidationIssue[] = []

  issues.push(...detectProhibitedKeys(doc))

  if (doc.metadata.schemaVersion !== ENCOUNTER_WORKSPACE_SCHEMA_VERSION) {
    issues.push(
      issue('WS-38', 'SCHEMA_VERSION', `schemaVersion debe ser ${ENCOUNTER_WORKSPACE_SCHEMA_VERSION}`, 'aggregate'),
    )
  }

  if (!Number.isInteger(doc.metadata.workspaceVersion) || doc.metadata.workspaceVersion < 1) {
    issues.push(
      issue('WS-38', 'WORKSPACE_VERSION_INVALID', 'workspaceVersion debe ser entero >= 1', 'aggregate'),
    )
  }

  if (!isIso8601(doc.metadata.createdAt) || !isIso8601(doc.metadata.updatedAt)) {
    issues.push(issue('WS-38', 'METADATA_TIMESTAMP_INVALID', 'metadata timestamps ISO inválidos', 'aggregate'))
  }

  if (options.expectedMatchId && doc.identity.matchId !== options.expectedMatchId) {
    issues.push(
      issue('WS-1', 'MATCH_ID_MISMATCH', 'matchId no coincide con expectedMatchId', 'identity'),
    )
  }

  issues.push(...validateIdentity(doc))

  const derivedLifecycle = deriveWorkspaceLifecyclePhase(doc)
  const derivedGate = deriveAlignmentGate(doc.alignments)

  if (doc.lifecycle.phase !== derivedLifecycle) {
    issues.push(
      issue(
        'WS-31',
        'LIFECYCLE_PHASE_MISMATCH',
        `lifecycle.phase=${doc.lifecycle.phase} pero derivado=${derivedLifecycle}`,
        'lifecycle',
      ),
    )
  }

  if (doc.lifecycle.phase === 'acta_closed' && doc.acta?.status !== 'ACTA_CERRADA') {
    issues.push(issue('WS-8', 'LIFECYCLE_ACTA_STATUS', 'acta_closed requiere acta ACTA_CERRADA', 'lifecycle'))
  }

  if (doc.lifecycle.phase === 'acta_in_progress' && doc.acta?.status !== 'ACTA_EN_CURSO') {
    issues.push(
      issue('WS-8', 'LIFECYCLE_ACTA_IN_PROGRESS', 'acta_in_progress requiere acta ACTA_EN_CURSO', 'lifecycle'),
    )
  }

  if (doc.acta === null && (doc.lifecycle.phase === 'acta_in_progress' || doc.lifecycle.phase === 'acta_closed')) {
    issues.push(issue('WS-5', 'LIFECYCLE_WITHOUT_ACTA', 'fase acta sin sección acta', 'acta'))
  }

  issues.push(...validateAlignments(doc))
  issues.push(...validateWorkflowAndActa(doc, options))

  if (doc.acta !== null) {
    if (!officialsIsEmpty(doc.officials)) {
      issues.push(
        issue(
          'WS-36',
          'OFFICIALS_POST_ACTA',
          'officials debe estar vacío cuando acta !== null',
          'officials',
        ),
      )
    }
    issues.push(...validateActaSection(doc.acta))
  } else if (doc.workflow.actaBinding === 'SUPERSEDED' && !doc.workflow.lastReopen) {
    issues.push(
      issue(
        'WS-7',
        'SUPERSEDED_WITHOUT_ACTA',
        'SUPERSEDED sin acta solo válido tras reopen documentado',
        'workflow',
        'warning',
      ),
    )
  }

  issues.push(...validateSync(doc))
  issues.push(...validateAudit(doc))

  const hasError = issues.some((i) => i.severity === 'error')
  return {
    ok: !hasError,
    issues,
    derivedLifecycle,
    derivedAlignmentGate: derivedGate,
  }
}
