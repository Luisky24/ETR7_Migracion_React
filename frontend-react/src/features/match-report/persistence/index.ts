export {
  assertLifecycleTransition,
  canClose,
  canEdit,
  canFirstSave,
  canReopen,
  canRecalculateClassification,
  canSaveDraft,
  isPersistedLifecycle,
  isTransitionAllowed,
  lifecycleFromDocumentStatus,
  nextLifecycleAfterTransition,
  targetStatusForTransition,
} from './lifecycleRules'
export {
  validateActaDocument,
  validateReopenMetadata,
  validateSaveIntent,
} from './documentValidators'
export type { ValidateActaDocumentOptions } from './documentValidators'
export type { ActaDocumentValidationIssue, ActaDocumentValidationResult } from './types'
export { ActaLifecycleViolationError } from './types'
export { ActaPersistenceError, cloneDocument } from './actaPersistenceError'
export {
  backupFileName,
  buildStorageKey,
  isAuxiliaryActaFile,
  keyFromDocument,
  officialFileName,
  previousFileName,
  tmpFileName,
} from './actaRepositoryKeys'
export {
  ActaRepositoryCore,
  type ActaDocumentStore,
  type ActaJsonPersistenceLogger,
  type ActaRepositoryCoreOptions,
} from './actaRepositoryCore'
