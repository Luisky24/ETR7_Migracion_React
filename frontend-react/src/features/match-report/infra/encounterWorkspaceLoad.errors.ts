import type { ActaPersistenceErrorCode } from '../contracts/actaDocument'

export type EncounterWorkspaceLoadErrorCode =
  | ActaPersistenceErrorCode
  | 'HYDRATE_FAILED'
  | 'WORKSPACE_SHELL_FAILED'

export class EncounterWorkspaceLoadError extends Error {
  readonly code: EncounterWorkspaceLoadErrorCode

  constructor(code: EncounterWorkspaceLoadErrorCode, message: string) {
    super(message)
    this.name = 'EncounterWorkspaceLoadError'
    this.code = code
  }
}

/** @deprecated Usar EncounterWorkspaceLoadError */
export const ActaBootstrapError = EncounterWorkspaceLoadError
/** @deprecated */
export type ActaBootstrapErrorCode = EncounterWorkspaceLoadErrorCode

export function workspaceLoadErrorFromPersistence(err: {
  readonly code: ActaPersistenceErrorCode
  readonly message: string
}): EncounterWorkspaceLoadError {
  return new EncounterWorkspaceLoadError(err.code, err.message)
}

/** @deprecated */
export const bootstrapErrorFromPersistence = workspaceLoadErrorFromPersistence
