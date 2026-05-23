import type { ActaDocumentV1 } from '../contracts/actaDocument'
import type { ActaDocumentStatus } from '../contracts/actaDocument/actaLifecycle.contract'
import type { ActaBinding } from '../contracts/encounterWorkflow.contract'
import { isBindingConsistentWithStatus } from '../utils/encounterWorkflow'
import type { ActaSaveOptions } from '../contracts/actaDocument/repository.contract'
import type { TeamTotals } from '../contracts/matchReport.contract'
import type { ActaDocumentValidationIssue, ActaDocumentValidationResult } from './types'

const SCHEMA_VERSION = 1 as const

function issue(
  invariantId: string,
  code: string,
  message: string,
): ActaDocumentValidationIssue {
  return { invariantId, code, message }
}

function fail(...issues: ActaDocumentValidationIssue[]): ActaDocumentValidationResult {
  return { ok: false, issues }
}

function ok(): ActaDocumentValidationResult {
  return { ok: true, issues: [] }
}

function isIso8601(value: string): boolean {
  const t = Date.parse(value)
  return Number.isFinite(t)
}

function isNonEmptyString(value: string | undefined): value is string {
  return value != null && value.trim().length > 0
}

function totalsCoherentWithPlayers(
  players: readonly { E: number; T: number; PC: number; Tar: number }[],
  totals: TeamTotals,
  side: string,
): ActaDocumentValidationIssue | null {
  const sum = players.reduce(
    (acc, p) => ({
      E: acc.E + p.E,
      T: acc.T + p.T,
      PC: acc.PC + p.PC,
      Tar: acc.Tar + p.Tar,
    }),
    { E: 0, T: 0, PC: 0, Tar: 0 },
  )
  if (
    sum.E !== totals.E ||
    sum.T !== totals.T ||
    sum.PC !== totals.PC ||
    sum.Tar !== totals.Tar
  ) {
    return issue(
      'F17',
      'TOTALS_PLAYER_MISMATCH',
      `Totales ${side} no coherentes con suma de jugadores`,
    )
  }
  return null
}

function classificationTotalCoherent(
  c: { P: number; BO: number; BD: number; Total: number },
  label: string,
): ActaDocumentValidationIssue | null {
  const expected = c.P + c.BO + c.BD
  if (Math.abs(expected - c.Total) > 1e-6) {
    return issue('F16', 'CLASSIFICATION_TOTAL_MISMATCH', `Total incoherente en ${label}`)
  }
  return null
}

export interface ValidateActaDocumentOptions {
  /** Para F2: validar que matchId del documento coincide con clave de carga. */
  readonly expectedMatchId?: string
  /** Para F5 en save: versión esperada en cliente vs documento. */
  readonly expectedDocumentVersion?: number
}

/**
 * Validación pura de invariantes F1–F26 (subset aplicable sin I/O).
 */
export function validateActaDocument(
  doc: ActaDocumentV1,
  options: ValidateActaDocumentOptions = {},
): ActaDocumentValidationResult {
  const issues: ActaDocumentValidationIssue[] = []
  const { metadata, match, localTeam, awayTeam, scoring, classification } = doc

  // F1
  if (metadata.schemaVersion !== SCHEMA_VERSION) {
    issues.push(issue('F1', 'SCHEMA_VERSION', 'schemaVersion debe ser 1'))
  }

  // F4
  if (!Number.isInteger(metadata.documentVersion) || metadata.documentVersion < 1) {
    issues.push(issue('F4', 'DOCUMENT_VERSION', 'documentVersion debe ser entero >= 1'))
  }

  // F5 (save stale)
  if (
    options.expectedDocumentVersion != null &&
    options.expectedDocumentVersion !== metadata.documentVersion
  ) {
    issues.push(
      issue(
        'F5',
        'DOCUMENT_VERSION_CONFLICT',
        `Versión esperada ${options.expectedDocumentVersion} ≠ ${metadata.documentVersion}`,
      ),
    )
  }

  // F8, F9
  if (metadata.status === 'ACTA_CERRADA' && !isNonEmptyString(metadata.closedAt)) {
    issues.push(issue('F8', 'CLOSED_AT_REQUIRED', 'ACTA_CERRADA requiere closedAt'))
  }
  if (metadata.status === 'ACTA_EN_CURSO' && metadata.reopenedAt) {
    if (!isNonEmptyString(metadata.reopenedBy)) {
      issues.push(issue('F11', 'REOPENED_BY_REQUIRED', 'reopenedBy obligatorio si reopenedAt existe'))
    }
  }

  // F11 reopen audit
  if (isNonEmptyString(metadata.reopenedAt) && !isNonEmptyString(metadata.reopenedBy)) {
    issues.push(issue('F11', 'REOPENED_BY_REQUIRED', 'reopenedBy obligatorio en reapertura'))
  }

  // F2, F3
  if (!isNonEmptyString(match.matchId)) {
    issues.push(issue('F2', 'MATCH_ID', 'matchId requerido'))
  }
  if (!isNonEmptyString(match.documentName)) {
    issues.push(issue('F2', 'DOCUMENT_NAME', 'documentName requerido'))
  }
  if (options.expectedMatchId != null && match.matchId !== options.expectedMatchId) {
    issues.push(issue('F3', 'MATCH_ID_MISMATCH', 'matchId no coincide con clave esperada'))
  }

  // Timestamps
  for (const [field, value] of [
    ['createdAt', metadata.createdAt],
    ['updatedAt', metadata.updatedAt],
    ['closedAt', metadata.closedAt],
    ['reopenedAt', metadata.reopenedAt],
  ] as const) {
    if (value != null && !isIso8601(value)) {
      issues.push(issue('F1', 'INVALID_TIMESTAMP', `${field} debe ser ISO-8601 válido`))
    }
  }

  // F13
  if (!classification?.local || !classification?.visitante) {
    issues.push(issue('F13', 'CLASSIFICATION_REQUIRED', 'classification local/visitante requerida'))
  } else {
    const localTotal = classificationTotalCoherent(classification.local, 'local')
    if (localTotal) issues.push(localTotal)
    const visitTotal = classificationTotalCoherent(classification.visitante, 'visitante')
    if (visitTotal) issues.push(visitTotal)

    // F16 official coherence
    if (classification.official) {
      const o = classification.official
      if (!isIso8601(o.appliedAt)) {
        issues.push(issue('F16', 'OFFICIAL_APPLIED_AT', 'classification.official.appliedAt inválido'))
      }
    }
  }

  // F17
  const localTotalsIssue = totalsCoherentWithPlayers(localTeam.players, localTeam.totals, 'local')
  if (localTotalsIssue) issues.push(localTotalsIssue)
  const awayTotalsIssue = totalsCoherentWithPlayers(awayTeam.players, awayTeam.totals, 'away')
  if (awayTotalsIssue) issues.push(awayTotalsIssue)

  // F18 score non-negative
  if (scoring.score.local < 0 || scoring.score.visitante < 0) {
    issues.push(issue('F18', 'NEGATIVE_SCORE', 'Marcador no puede ser negativo'))
  }

  // F19 encounterWorkflow / actaBinding
  const binding: ActaBinding = metadata.encounterWorkflow?.actaBinding ?? 'ACTIVE'
  if (binding !== 'ACTIVE' && binding !== 'SUPERSEDED') {
    issues.push(issue('F19', 'INVALID_ACTA_BINDING', 'actaBinding debe ser ACTIVE o SUPERSEDED'))
  }
  if (!isBindingConsistentWithStatus(metadata.status, binding)) {
    issues.push(issue('F19', 'BINDING_STATUS_MISMATCH', 'actaBinding inconsistente con status'))
  }
  const lastReopen = metadata.encounterWorkflow?.lastReopen
  if (lastReopen) {
    if (!isIso8601(lastReopen.at)) {
      issues.push(issue('F19', 'INVALID_REOPEN_AT', 'lastReopen.at debe ser ISO-8601'))
    }
    if (!isNonEmptyString(lastReopen.by)) {
      issues.push(issue('F19', 'REOPEN_BY_REQUIRED', 'lastReopen.by obligatorio'))
    }
    if (
      lastReopen.mode === 'REOPEN_ALIGNMENTS' &&
      binding !== 'SUPERSEDED'
    ) {
      issues.push(
        issue(
          'F19',
          'REOPEN_ALIGNMENTS_REQUIRES_SUPERSEDED',
          'REOPEN_ALIGNMENTS requiere actaBinding SUPERSEDED',
        ),
      )
    }
    if (lastReopen.mode === 'REOPEN_ACTA' && binding === 'SUPERSEDED') {
      issues.push(
        issue(
          'F19',
          'REOPEN_ACTA_REQUIRES_ACTIVE',
          'REOPEN_ACTA requiere actaBinding ACTIVE',
        ),
      )
    }
  }

  return issues.length === 0 ? ok() : fail(...issues)
}

export function validateSaveIntent(
  status: ActaDocumentStatus,
  options: ActaSaveOptions,
): ActaDocumentValidationResult {
  if (options.intent === 'close' && status !== 'ACTA_EN_CURSO') {
    return fail(
      issue('F10', 'LIFECYCLE_VIOLATION', 'Cierre solo permitido desde ACTA_EN_CURSO'),
    )
  }
  if (options.intent === 'draft' && status !== 'ACTA_EN_CURSO') {
    return fail(
      issue('F10', 'LIFECYCLE_VIOLATION', 'Borrador solo permitido en ACTA_EN_CURSO'),
    )
  }
  return ok()
}

export function validateReopenMetadata(
  reopenedBy: string | undefined,
  reopenedAt: string,
): ActaDocumentValidationResult {
  const issues: ActaDocumentValidationIssue[] = []
  if (!isNonEmptyString(reopenedBy)) {
    issues.push(issue('F11', 'REOPENED_BY_REQUIRED', 'reopenedBy obligatorio'))
  }
  if (!isIso8601(reopenedAt)) {
    issues.push(issue('F11', 'INVALID_REOPENED_AT', 'reopenedAt debe ser ISO-8601'))
  }
  return issues.length === 0 ? ok() : fail(...issues)
}
