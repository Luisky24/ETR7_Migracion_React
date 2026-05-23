/**
 * Persistencia JSON oficial: draft save y close vía repositorio documental.
 * Sin Sheets; validación lifecycle en repositorio.
 */

import { log } from '@/core/debug'
import type {
  ActaDocumentMetadata,
  ActaDocumentV1,
  ActaRepository,
  ActaSaveResult,
} from '../contracts/actaDocument'
import type { MatchClosureResult, MatchReport } from '../contracts'
import type { ServiceResult } from '../contracts/service-result.contract'
import {
  serviceFatalError,
  serviceRecoverableError,
  serviceSuccess,
  serviceValidationError,
} from '../contracts/service-result.contract'
import { projectMatchReportToActaDocument } from '../adapters/actaProjection.adapter'
import { applyGasOfficialClassification } from '../domain/classification'
import { createJsonPersistenceRepository } from '../infra/jsonPersistence.adapter'
import type { JsonPersistenceRepositoryOptions } from '../infra/jsonPersistence.adapter'
import { ActaPersistenceError } from '../persistence/actaPersistenceError'
import {
  actaMatchKeyFromContext,
  createInitialPersistenceSession,
  getActaPersistenceSession,
  sessionFromActaDocument,
  setActaPersistenceSession,
  type ActaPersistenceSession,
} from './actaPersistenceSession'
import {
  normalizePersistenceSaveError,
  normalizePersistenceThrownError,
} from '../utils/persistenceSaveErrors'
import { defaultEncounterWorkflow } from '../utils/encounterWorkflow'
import {
  scheduleCalendarSyncAfterPersist,
  type CalendarSyncServiceOptions,
} from './calendarSync.service'

const SAVE_LOG = 'matchReportSave'
const RUNTIME_SAVED_BY = 'etr7-runtime'

export interface ActaPersistenceServiceDeps {
  readonly repository?: ActaRepository
  readonly repositoryOptions?: JsonPersistenceRepositoryOptions
  readonly savedBy?: string
  readonly calendarSync?: CalendarSyncServiceOptions
}

function logSave(event: string, detail?: Record<string, unknown>): void {
  log.debug(`[${SAVE_LOG}] ${event}`, detail ?? {})
}

function placeholderMetadata(): ActaDocumentMetadata {
  return {
    schemaVersion: 1,
    documentVersion: 0,
    status: 'ACTA_EN_CURSO',
    createdAt: '',
    updatedAt: '',
  }
}

function mapSaveResultToService<T>(
  result: ActaSaveResult,
  onSuccess: (version: number) => T,
): ServiceResult<T> {
  if (result.ok) {
    return serviceSuccess(onSuccess(result.documentVersion))
  }
  const err = normalizePersistenceSaveError(result)
  logSave('persistence.fail', { code: result.code, message: result.message })
  if (result.code === 'DOCUMENT_VERSION_CONFLICT') {
    logSave('version.conflict', { message: result.message })
  }
  if (result.code === 'CORRUPT_DOCUMENT') {
    logSave('corruption', { message: result.message })
    return serviceFatalError(err)
  }
  if (result.code === 'VALIDATION_FAILED' || result.code === 'LIFECYCLE_VIOLATION') {
    return serviceValidationError(err)
  }
  return err.recoverable ? serviceRecoverableError(err) : serviceFatalError(err)
}

async function resolvePersistenceSession(
  report: MatchReport,
  repository: ActaRepository,
): Promise<ActaPersistenceSession> {
  const matchId = report.context.encuentroId
  const cached = getActaPersistenceSession(matchId)
  if (cached) return cached

  const key = actaMatchKeyFromContext(report.context)
  try {
    const existing = await repository.load(key)
    if (existing) {
      const session = sessionFromActaDocument(existing)
      setActaPersistenceSession(matchId, session)
      return session
    }
  } catch (err) {
    if (err instanceof ActaPersistenceError && err.code === 'CORRUPT_DOCUMENT') {
      throw err
    }
  }

  const initial = createInitialPersistenceSession(report.context)
  setActaPersistenceSession(matchId, initial)
  return initial
}

async function buildProjectedDocument(
  report: MatchReport,
  session: ActaPersistenceSession,
  repository: ActaRepository,
  classificationOverride?: ActaDocumentV1['classification'],
): Promise<ActaDocumentV1> {
  const key = actaMatchKeyFromContext(report.context)
  const existing = await repository.load(key)
  const encounterWorkflow = existing?.metadata.encounterWorkflow ?? defaultEncounterWorkflow()
  const doc = projectMatchReportToActaDocument({
    metadata: { ...placeholderMetadata(), encounterWorkflow },
    report,
    encounterNumber: session.encounterNumber,
    documentName: session.documentName,
  })
  if (classificationOverride) {
    return { ...doc, classification: classificationOverride }
  }
  return doc
}

function applyOfficialClassificationOnClose(
  report: MatchReport,
  gasOfficial: { readonly isCopaGroup: boolean; readonly f2BonusPoints?: number },
  appliedAt: string,
): ActaDocumentV1['classification'] {
  const official = applyGasOfficialClassification({
    preview: {
      local: report.local.classification,
      visitante: report.visitante.classification,
    },
    score: report.score,
    phase: report.context.phase,
    isCopaGroup: gasOfficial.isCopaGroup,
    f2BonusPoints: gasOfficial.f2BonusPoints,
  })
  return {
    local: official.local,
    visitante: official.visitante,
    official: {
      local: official.local,
      visitante: official.visitante,
      source: 'server',
      appliedAt,
    },
  }
}

function updateSessionAfterSave(
  matchId: string,
  session: ActaPersistenceSession,
  nextVersion: number,
): void {
  setActaPersistenceSession(matchId, {
    ...session,
    documentVersion: nextVersion,
  })
}

export async function saveActaDraftJson(
  report: MatchReport,
  deps: ActaPersistenceServiceDeps = {},
): Promise<ServiceResult<{ readonly ok: true; readonly report: MatchReport }>> {
  const repository = deps.repository ?? createJsonPersistenceRepository(deps.repositoryOptions)
  const matchId = report.context.encuentroId
  const key = actaMatchKeyFromContext(report.context)

  logSave('draft.start', { matchId })

  let session: ActaPersistenceSession
  try {
    session = await resolvePersistenceSession(report, repository)
  } catch (err) {
    if (err instanceof ActaPersistenceError) {
      logSave('corruption', { matchId, message: err.message })
      return serviceFatalError(normalizePersistenceThrownError(err))
    }
    throw err
  }

  const lifecycle = await repository.resolveLifecycle(key)
  logSave('lifecycle', { matchId, lifecycle, expectedVersion: session.documentVersion })

  const document = await buildProjectedDocument(report, session, repository)
  const expectedDocumentVersion =
    lifecycle === 'NO_EXISTE' || session.documentVersion === 0
      ? undefined
      : session.documentVersion

  let result: ActaSaveResult
  try {
    result = await repository.save(document, {
      intent: 'draft',
      expectedDocumentVersion,
      savedBy: deps.savedBy ?? RUNTIME_SAVED_BY,
    })
  } catch (err) {
    logSave('draft.error', { matchId, message: err instanceof Error ? err.message : String(err) })
    const normalized = normalizePersistenceThrownError(err)
    return normalized.recoverable ? serviceRecoverableError(normalized) : serviceFatalError(normalized)
  }

  return mapSaveResultToService(result, (version) => {
    updateSessionAfterSave(matchId, session, version)
    logSave('draft.ok', { matchId, documentVersion: version, lifecycle: 'ACTA_EN_CURSO' })
    return { ok: true as const, report }
  })
}

export interface CloseActaJsonOptions {
  readonly gasOfficial?: { readonly isCopaGroup: boolean; readonly f2BonusPoints?: number }
}

export async function closeActaJson(
  report: MatchReport,
  deps: ActaPersistenceServiceDeps = {},
  options: CloseActaJsonOptions = {},
): Promise<ServiceResult<MatchClosureResult>> {
  const repository = deps.repository ?? createJsonPersistenceRepository(deps.repositoryOptions)
  const matchId = report.context.encuentroId
  const key = actaMatchKeyFromContext(report.context)

  logSave('close.start', { matchId })

  let session: ActaPersistenceSession
  try {
    session = await resolvePersistenceSession(report, repository)
  } catch (err) {
    if (err instanceof ActaPersistenceError) {
      logSave('corruption', { matchId, message: err.message })
      return serviceFatalError(normalizePersistenceThrownError(err))
    }
    throw err
  }

  const lifecycle = await repository.resolveLifecycle(key)
  if (lifecycle === 'NO_EXISTE') {
    logSave('close.rejected', { matchId, reason: 'NO_EXISTE' })
    return serviceValidationError(
      normalizePersistenceThrownError('No existe acta JSON para cerrar; guarde borrador primero.'),
    )
  }

  logSave('lifecycle', { matchId, lifecycle, expectedVersion: session.documentVersion })

  const appliedAt = new Date().toISOString()
  const classification =
    options.gasOfficial != null
      ? applyOfficialClassificationOnClose(report, options.gasOfficial, appliedAt)
      : undefined

  const document = await buildProjectedDocument(report, session, repository, classification)
  const expectedDocumentVersion =
    session.documentVersion > 0 ? session.documentVersion : undefined

  if (expectedDocumentVersion == null) {
    return serviceValidationError(
      normalizePersistenceThrownError('Falta documentVersion para cerrar el acta.'),
    )
  }

  let result: ActaSaveResult
  try {
    result = await repository.save(document, {
      intent: 'close',
      expectedDocumentVersion,
      savedBy: deps.savedBy ?? RUNTIME_SAVED_BY,
    })
  } catch (err) {
    logSave('close.error', { matchId, message: err instanceof Error ? err.message : String(err) })
    const normalized = normalizePersistenceThrownError(err)
    return normalized.recoverable ? serviceRecoverableError(normalized) : serviceFatalError(normalized)
  }

  const serviceResult = mapSaveResultToService(result, (version) => {
    updateSessionAfterSave(matchId, session, version)
    logSave('close.ok', { matchId, documentVersion: version, lifecycle: 'ACTA_CERRADA' })

    let serverClassification: MatchClosureResult['serverClassification']
    if (options.gasOfficial != null) {
      serverClassification = applyGasOfficialClassification({
        preview: {
          local: report.local.classification,
          visitante: report.visitante.classification,
        },
        score: report.score,
        phase: report.context.phase,
        isCopaGroup: options.gasOfficial.isCopaGroup,
        f2BonusPoints: options.gasOfficial.f2BonusPoints,
      })
    } else if (classification?.official) {
      serverClassification = {
        local: classification.official.local,
        visitante: classification.official.visitante,
      }
    }

    return { ok: true, cerrada: true, serverClassification }
  })

  if (serviceResult.kind === 'success') {
    const committed = await repository.load(key)
    if (committed) {
      scheduleCalendarSyncAfterPersist(committed, 'close', deps.calendarSync)
    }
  }

  return serviceResult
}
