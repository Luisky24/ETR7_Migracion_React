/**
 * Validación pura del agregado AlignmentDocumentV1 (ETR7).
 * Sin I/O, sin runtime React, sin persistencia.
 */

import type {
  AlignmentAuditEventV1,
  AlignmentDocumentV1,
  AlignmentLifecycleState,
  AlignmentLifecycleTransitionV1,
  AlignmentPlayerV1,
  AlignmentSelectionV1,
} from './alignment.document'
import type { InvariantCategory, InvariantSeverity } from './alignment.invariants'
import { deriveAlignmentLifecycleState } from './alignment.helpers'
import { isAlignmentLifecycleTransitionAllowed } from './alignment.lifecycle'

export interface AlignmentValidationIssue {
  readonly invariantId: string
  readonly code: string
  readonly message: string
  readonly severity: InvariantSeverity
  readonly category: InvariantCategory
}

export interface AlignmentValidationResult {
  readonly ok: boolean
  readonly issues: readonly AlignmentValidationIssue[]
  readonly derivedLifecycleState: AlignmentLifecycleState
}

export interface ValidateAlignmentOptions {
  /** Para persistencia A3: validar que matchId coincide con clave de carga. */
  readonly expectedMatchId?: string
  /** Para optimistic locking A3 (si el caller lo necesita). */
  readonly expectedDocumentVersion?: number
}

function issue(
  invariantId: string,
  code: string,
  message: string,
  category: InvariantCategory,
  severity: InvariantSeverity = 'error',
): AlignmentValidationIssue {
  return { invariantId, code, message, severity, category }
}

function isIso8601(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}

function isNonEmptyString(value: string | undefined | null): value is string {
  return value != null && value.trim().length > 0
}

function expectedStorageKey(identity: AlignmentDocumentV1['identity']): string {
  // A2.6 congelado: `encounterId` NO participa en identidad persistente; es solo display/naming.
  return `${identity.categoryId}::${identity.seasonId}::${identity.phaseId}::${identity.matchId}::${identity.teamId}`
}

function selectionIds(selection: AlignmentSelectionV1): string[] {
  return [...selection.starters, ...selection.bench]
}

function uniqueStrings(ids: readonly string[]): boolean {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) return false
    seen.add(id)
  }
  return true
}

function validatePlayers(players: readonly AlignmentPlayerV1[]): AlignmentValidationIssue[] {
  const issues: AlignmentValidationIssue[] = []
  const playerIds = new Set<string>()
  const dorsals = new Set<number>()

  for (let i = 0; i < players.length; i += 1) {
    const p = players[i]
    if (!p) continue

    if (!isNonEmptyString(p.playerId)) {
      issues.push(issue('ALI-01', 'PLAYER_ID_REQUIRED', `players[${i}].playerId requerido`, 'players'))
    } else if (playerIds.has(p.playerId)) {
      issues.push(issue('ALI-01', 'PLAYER_ID_DUPLICATE', `playerId duplicado: ${p.playerId}`, 'players'))
    }
    playerIds.add(p.playerId)

    if (!Number.isInteger(p.dorsal) || p.dorsal < 0) {
      issues.push(issue('ALI-02', 'DORSAL_INVALID', `dorsal inválido: ${p.dorsal}`, 'players'))
    } else if (dorsals.has(p.dorsal)) {
      issues.push(issue('ALI-02', 'DORSAL_DUPLICATE', `dorsal duplicado: ${p.dorsal}`, 'players'))
    }
    dorsals.add(p.dorsal)

    if (!isNonEmptyString(p.displayName)) {
      issues.push(issue('ALI-01', 'DISPLAY_NAME_REQUIRED', `players[${i}].displayName requerido`, 'players'))
    }
  }

  return issues
}

function validateSelection(
  selection: AlignmentSelectionV1,
  players: readonly AlignmentPlayerV1[],
): AlignmentValidationIssue[] {
  const issues: AlignmentValidationIssue[] = []
  const playerIdSet = new Set(players.map((p) => p.playerId))

  if (!uniqueStrings(selection.starters)) {
    issues.push(issue('ALI-03', 'STARTERS_DUPLICATE', 'starters contiene duplicados', 'selection'))
  }
  if (!uniqueStrings(selection.bench)) {
    issues.push(issue('ALI-03', 'BENCH_DUPLICATE', 'bench contiene duplicados', 'selection'))
  }

  const startersSet = new Set(selection.starters)
  for (const id of selection.bench) {
    if (startersSet.has(id)) {
      issues.push(issue('ALI-03', 'STARTERS_BENCH_OVERLAP', 'starters ∩ bench debe ser vacío', 'selection'))
      break
    }
  }

  for (const id of selectionIds(selection)) {
    if (!playerIdSet.has(id)) {
      issues.push(issue('ALI-04', 'SELECTION_UNKNOWN_PLAYER', `selection referencia playerId inexistente: ${id}`, 'selection'))
    }
  }

  if (selection.captain != null) {
    const all = new Set(selectionIds(selection))
    if (!all.has(selection.captain)) {
      issues.push(issue('ALI-04', 'CAPTAIN_NOT_IN_SELECTION', 'captain debe pertenecer a starters o bench', 'selection'))
    }
  }

  if (selection.goalkeeper != null) {
    const all = new Set(selectionIds(selection))
    if (!all.has(selection.goalkeeper)) {
      issues.push(
        issue('ALI-04', 'GOALKEEPER_NOT_IN_SELECTION', 'goalkeeper debe pertenecer a starters o bench', 'selection'),
      )
    }
  }

  return issues
}

function validateHistory(history: readonly AlignmentLifecycleTransitionV1[]): AlignmentValidationIssue[] {
  const issues: AlignmentValidationIssue[] = []
  let prevAt: number | null = null
  for (let i = 0; i < history.length; i += 1) {
    const t = history[i]
    if (!t) continue

    if (!isIso8601(t.at)) {
      issues.push(issue('ALI-10', 'HISTORY_TIMESTAMP_INVALID', `history[${i}].at inválido`, 'lifecycle'))
    }
    const atMs = Date.parse(t.at)
    if (prevAt != null && atMs < prevAt) {
      issues.push(issue('ALI-10', 'HISTORY_NOT_APPEND_ORDER', 'lifecycle.history no monotónico', 'lifecycle'))
    }
    prevAt = atMs

    if (!isAlignmentLifecycleTransitionAllowed(t.from, t.to)) {
      issues.push(
        issue('ALI-10', 'LIFECYCLE_TRANSITION_INVALID', `Transición no permitida ${t.from}→${t.to}`, 'lifecycle'),
      )
    }

    if (t.from === 'CLOSED' && t.to === 'REOPENED') {
      if (!isNonEmptyString(t.reason)) {
        issues.push(
          issue('ALI-07', 'REOPEN_REASON_REQUIRED', 'CLOSED→REOPENED requiere reason en history', 'lifecycle'),
        )
      }
    }
  }
  return issues
}

function validateAudit(events: readonly AlignmentAuditEventV1[]): AlignmentValidationIssue[] {
  const issues: AlignmentValidationIssue[] = []
  let prevAt: number | null = null
  for (let i = 0; i < events.length; i += 1) {
    const ev = events[i]
    if (!ev) continue

    if (!isIso8601(ev.at)) {
      issues.push(issue('ALI-09', 'AUDIT_TIMESTAMP_INVALID', `audit.events[${i}].at inválido`, 'audit'))
    }
    const atMs = Date.parse(ev.at)
    if (prevAt != null && atMs < prevAt) {
      issues.push(issue('ALI-09', 'AUDIT_NOT_APPEND_ORDER', 'audit.events no monotónico', 'audit'))
    }
    prevAt = atMs

    if (ev.kind === 'ALIGNMENT_REOPENED') {
      if (!isNonEmptyString(ev.reason)) {
        issues.push(issue('ALI-07', 'AUDIT_REOPEN_REASON_REQUIRED', 'ALIGNMENT_REOPENED requiere reason', 'audit'))
      }
    }
  }
  return issues
}

function sameSelection(a: AlignmentSelectionV1, b: AlignmentSelectionV1): boolean {
  const eqArray = (x: readonly string[], y: readonly string[]) =>
    x.length === y.length && x.every((v, i) => v === y[i])
  return (
    eqArray(a.starters, b.starters) &&
    eqArray(a.bench, b.bench) &&
    (a.captain ?? null) === (b.captain ?? null) &&
    (a.goalkeeper ?? null) === (b.goalkeeper ?? null)
  )
}

function samePlayers(a: readonly AlignmentPlayerV1[], b: readonly AlignmentPlayerV1[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const pa = a[i]
    const pb = b[i]
    if (!pa || !pb) return false
    if (
      pa.playerId !== pb.playerId ||
      pa.displayName !== pb.displayName ||
      pa.dorsal !== pb.dorsal ||
      (pa.position ?? '') !== (pb.position ?? '')
    ) {
      return false
    }
  }
  return true
}

function validateClosureAndSnapshot(doc: AlignmentDocumentV1): AlignmentValidationIssue[] {
  const issues: AlignmentValidationIssue[] = []
  const isClosed = doc.lifecycle.state === 'CLOSED'
  if (isClosed && !doc.closure) {
    issues.push(issue('ALI-11', 'CLOSED_REQUIRES_CLOSURE', 'CLOSED requiere closure', 'closure'))
    return issues
  }
  if (!doc.closure) return issues

  const c = doc.closure
  if (!isIso8601(c.closedAt)) {
    issues.push(issue('ALI-05', 'CLOSED_AT_INVALID', 'closure.closedAt debe ser ISO-8601', 'closure'))
  }
  if (!isNonEmptyString(c.closedBy)) {
    issues.push(issue('ALI-05', 'CLOSED_BY_REQUIRED', 'closure.closedBy requerido', 'closure'))
  }
  if (!Number.isInteger(c.closeRevision) || c.closeRevision < 1) {
    issues.push(issue('ALI-06', 'CLOSE_REVISION_INVALID', 'closeRevision debe ser entero >= 1', 'closure'))
  }

  const snapshotPlayers = c.snapshot.players
  const snapshotSelection = c.snapshot.selection
  issues.push(...validatePlayers(snapshotPlayers))
  issues.push(...validateSelection(snapshotSelection, snapshotPlayers))

  // ALI-08: coherencia interna snapshot (ids existen en snapshot.players) ya cubierto en validateSelection

  // ALI-12: cuando CLOSED, root debe coincidir con snapshot para evitar doble verdad documental.
  if (isClosed) {
    if (!samePlayers(doc.players, snapshotPlayers)) {
      issues.push(issue('ALI-12', 'ROOT_PLAYERS_MISMATCH', 'root.players debe coincidir con snapshot.players en CLOSED', 'closure'))
    }
    if (!sameSelection(doc.selection, snapshotSelection)) {
      issues.push(
        issue('ALI-12', 'ROOT_SELECTION_MISMATCH', 'root.selection debe coincidir con snapshot.selection en CLOSED', 'closure'),
      )
    }
  }

  return issues
}

export function validateAlignmentDocument(
  doc: AlignmentDocumentV1,
  options: ValidateAlignmentOptions = {},
): AlignmentValidationResult {
  const issues: AlignmentValidationIssue[] = []

  if (doc.schema !== 'AlignmentDocumentV1') {
    issues.push(issue('ALI-01', 'SCHEMA', 'schema debe ser AlignmentDocumentV1', 'aggregate'))
  }

  // metadata hardening: schemaVersion + documentVersion (optimistic locking)
  if (doc.metadata.schemaVersion !== 1) {
    issues.push(issue('ALI-01', 'SCHEMA_VERSION', 'metadata.schemaVersion debe ser 1', 'metadata'))
  }
  if (!Number.isInteger(doc.metadata.documentVersion) || doc.metadata.documentVersion < 1) {
    issues.push(issue('ALI-01', 'DOCUMENT_VERSION_INVALID', 'metadata.documentVersion debe ser entero >= 1', 'metadata'))
  }
  if (
    options.expectedDocumentVersion != null &&
    options.expectedDocumentVersion !== doc.metadata.documentVersion
  ) {
    issues.push(
      issue(
        'ALI-01',
        'DOCUMENT_VERSION_CONFLICT',
        `Versión esperada ${options.expectedDocumentVersion} ≠ ${doc.metadata.documentVersion}`,
        'metadata',
      ),
    )
  }
  if (!isIso8601(doc.metadata.createdAt) || !isIso8601(doc.metadata.updatedAt)) {
    issues.push(issue('ALI-01', 'METADATA_TIMESTAMP_INVALID', 'metadata timestamps ISO inválidos', 'metadata'))
  }

  // identity hardening: storageKey estable (no depende filename)
  const expectedKey = expectedStorageKey(doc.identity)
  if (!isNonEmptyString(doc.identity.storageKey)) {
    issues.push(issue('ALI-01', 'STORAGE_KEY_REQUIRED', 'identity.storageKey requerido', 'identity'))
  } else if (doc.identity.storageKey !== expectedKey) {
    issues.push(
      issue(
        'ALI-01',
        'STORAGE_KEY_MISMATCH',
        `identity.storageKey esperado ${expectedKey}`,
        'identity',
      ),
    )
  }
  if (options.expectedMatchId && doc.identity.matchId !== options.expectedMatchId) {
    issues.push(issue('ALI-01', 'MATCH_ID_MISMATCH', 'identity.matchId no coincide con expectedMatchId', 'identity'))
  }

  // root structures
  issues.push(...validatePlayers(doc.players))
  issues.push(...validateSelection(doc.selection, doc.players))

  // lifecycle hardening
  const derivedLifecycleState = deriveAlignmentLifecycleState(doc.lifecycle)
  if (doc.lifecycle.state !== derivedLifecycleState) {
    issues.push(
      issue(
        'ALI-10',
        'LIFECYCLE_STATE_MISMATCH',
        `lifecycle.state=${doc.lifecycle.state} pero derivado=${derivedLifecycleState}`,
        'lifecycle',
      ),
    )
  }

  issues.push(...validateHistory(doc.lifecycle.history))

  // prevent REOPENED without prior CLOSED in history
  if (doc.lifecycle.state === 'REOPENED') {
    const hasClosed = doc.lifecycle.history.some((t) => t.to === 'CLOSED')
    if (!hasClosed) {
      issues.push(issue('ALI-10', 'REOPENED_WITHOUT_CLOSED', 'REOPENED requiere CLOSED previo en history', 'lifecycle'))
    }
    const last = doc.lifecycle.history.at(-1)
    if (last && !(last.from === 'CLOSED' && last.to === 'REOPENED')) {
      issues.push(
        issue('ALI-10', 'REOPENED_LAST_TRANSITION', 'REOPENED requiere última transición CLOSED→REOPENED', 'lifecycle'),
      )
    }
  }

  // closure + snapshot semantics
  issues.push(...validateClosureAndSnapshot(doc))

  // audit hardening (append-only conceptual)
  issues.push(...validateAudit(doc.audit.events))

  // If history contains reopen transition, require audit event too (A2.5)
  const hasReopenTransition = doc.lifecycle.history.some((t) => t.from === 'CLOSED' && t.to === 'REOPENED')
  if (hasReopenTransition) {
    const hasAudit = doc.audit.events.some((e) => e.kind === 'ALIGNMENT_REOPENED')
    if (!hasAudit) {
      issues.push(issue('ALI-07', 'REOPEN_AUDIT_REQUIRED', 'Reopen requiere audit event ALIGNMENT_REOPENED', 'audit'))
    }
  }

  const hasError = issues.some((i) => i.severity === 'error')
  return { ok: !hasError, issues, derivedLifecycleState }
}

