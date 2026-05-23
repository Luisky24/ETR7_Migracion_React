import type { EncounterWorkspaceLoadErrorCode } from '../infra/encounterWorkspaceLoad.errors'
import { EncounterWorkspaceLoadError } from '../infra/encounterWorkspaceLoad.errors'
import type { NormalizedOperationError } from '../types/matchReportOperation.types'
import { normalizeOperationError } from './errorNormalizer'

const WORKSPACE_LOAD_USER_MESSAGES: Partial<Record<EncounterWorkspaceLoadErrorCode, string>> = {
  CORRUPT_DOCUMENT:
    'El encuentro documental está dañado o es inválido. Contacte con soporte.',
  HYDRATE_FAILED: 'No se pudo reconstruir el acta desde Encounter Workspace.',
  WORKSPACE_SHELL_FAILED: 'No se pudo inicializar el encuentro documental.',
  IO_FAILURE: 'Error de acceso al repositorio documental del encuentro.',
  VALIDATION_FAILED: 'El encuentro documental no cumple las reglas de validación.',
}

function workspaceLoadCodeToOperationCode(code: EncounterWorkspaceLoadErrorCode): string {
  switch (code) {
    case 'CORRUPT_DOCUMENT':
      return 'CORRUPT_DOCUMENT'
    case 'HYDRATE_FAILED':
    case 'VALIDATION_FAILED':
      return 'VALIDATION_FAILED'
    case 'WORKSPACE_SHELL_FAILED':
      return 'SERVER_ERROR'
    case 'IO_FAILURE':
      return 'SERVER_ERROR'
    case 'DOCUMENT_VERSION_CONFLICT':
    case 'LIFECYCLE_VIOLATION':
    case 'ALREADY_EXISTS':
      return 'SERVER_ERROR'
    default:
      return 'SERVER_ERROR'
  }
}

function isWorkspaceLoadRecoverable(code: EncounterWorkspaceLoadErrorCode): boolean {
  return code === 'IO_FAILURE' || code === 'HYDRATE_FAILED' || code === 'WORKSPACE_SHELL_FAILED'
}

export function normalizeWorkspaceLoadError(input: unknown): NormalizedOperationError {
  if (input instanceof EncounterWorkspaceLoadError) {
    const opCode = workspaceLoadCodeToOperationCode(input.code)
    const base = normalizeOperationError(input.message, { code: opCode })
    const userMessage = WORKSPACE_LOAD_USER_MESSAGES[input.code] ?? base.userMessage
    const recoverable = isWorkspaceLoadRecoverable(input.code)
    return {
      ...base,
      code: input.code === 'CORRUPT_DOCUMENT' ? 'CORRUPT_DOCUMENT' : base.code,
      userMessage,
      technicalMessage: input.message,
      recoverable: input.code === 'CORRUPT_DOCUMENT' ? false : recoverable,
      retryable: recoverable && input.code !== 'CORRUPT_DOCUMENT',
      shouldReload: input.code === 'CORRUPT_DOCUMENT' || base.shouldReload,
      shouldBlock: input.code === 'CORRUPT_DOCUMENT',
    }
  }
  return normalizeOperationError(input)
}

/** @deprecated Usar normalizeWorkspaceLoadError */
export const normalizeBootstrapLoadError = normalizeWorkspaceLoadError
