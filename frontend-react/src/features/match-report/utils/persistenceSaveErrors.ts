import type { ActaPersistenceErrorCode, ActaSaveResult } from '../contracts/actaDocument'
import type { NormalizedOperationError } from '../types/matchReportOperation.types'
import { ActaPersistenceError } from '../persistence/actaPersistenceError'
import { normalizeOperationError } from './errorNormalizer'

const SAVE_USER_MESSAGES: Partial<Record<ActaPersistenceErrorCode, string>> = {
  DOCUMENT_VERSION_CONFLICT:
    'El acta fue modificada en otro lugar. Recargue el encuentro y vuelva a guardar.',
  CORRUPT_DOCUMENT:
    'El acta guardada en JSON está dañada o es inválida. Contacte con soporte.',
  LIFECYCLE_VIOLATION: 'No se puede guardar o cerrar el acta en el estado actual.',
  VALIDATION_FAILED: 'El documento del acta no cumple las reglas de validación.',
  IO_FAILURE: 'Error de acceso al repositorio JSON del acta.',
  ALREADY_EXISTS: 'Ya existe un acta para este encuentro; recargue antes de guardar.',
}

function saveCodeToOperationCode(code: ActaPersistenceErrorCode): string {
  if (code === 'DOCUMENT_VERSION_CONFLICT') return 'DOCUMENT_VERSION_CONFLICT'
  if (code === 'CORRUPT_DOCUMENT') return 'CORRUPT_DOCUMENT'
  if (code === 'VALIDATION_FAILED' || code === 'LIFECYCLE_VIOLATION') return 'VALIDATION_FAILED'
  return 'SERVER_ERROR'
}

function isSaveRecoverable(code: ActaPersistenceErrorCode): boolean {
  return code === 'IO_FAILURE' || code === 'DOCUMENT_VERSION_CONFLICT'
}

export function normalizePersistenceSaveError(
  result: Extract<ActaSaveResult, { readonly ok: false }>,
): NormalizedOperationError {
  const opCode = saveCodeToOperationCode(result.code)
  const base = normalizeOperationError(result.message ?? result.code, { code: opCode })
  const userMessage = SAVE_USER_MESSAGES[result.code] ?? base.userMessage
  const recoverable = isSaveRecoverable(result.code)
  const isConflict = result.code === 'DOCUMENT_VERSION_CONFLICT'
  const isCorrupt = result.code === 'CORRUPT_DOCUMENT'

  return {
    ...base,
    code: isCorrupt ? 'CORRUPT_DOCUMENT' : isConflict ? 'DOCUMENT_VERSION_CONFLICT' : base.code,
    userMessage,
    technicalMessage: result.message ?? result.code,
    recoverable: isCorrupt ? false : recoverable,
    retryable: recoverable && !isConflict && !isCorrupt,
    shouldReload: isConflict || isCorrupt || base.shouldReload,
    shouldBlock: isCorrupt,
  }
}

export function normalizePersistenceThrownError(input: unknown): NormalizedOperationError {
  if (input instanceof ActaPersistenceError && input.code === 'CORRUPT_DOCUMENT') {
    return normalizePersistenceSaveError({ ok: false, code: 'CORRUPT_DOCUMENT', message: input.message })
  }
  return normalizeOperationError(input)
}
