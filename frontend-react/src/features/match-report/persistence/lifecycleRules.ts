import type {
  ActaDocumentStatus,
  ActaLifecycleState,
  ActaLifecycleTransition,
} from '../contracts/actaDocument'
import { ActaLifecycleViolationError } from './types'

export function isPersistedLifecycle(state: ActaLifecycleState): state is ActaDocumentStatus {
  return state === 'ACTA_EN_CURSO' || state === 'ACTA_CERRADA'
}

export function lifecycleFromDocumentStatus(status: ActaDocumentStatus): ActaLifecycleState {
  return status
}

/** Edición rugby permitida solo con acta en curso. */
export function canEdit(status: ActaDocumentStatus): boolean {
  return status === 'ACTA_EN_CURSO'
}

/** Classification preview recalculable solo en curso. */
export function canRecalculateClassification(status: ActaDocumentStatus): boolean {
  return status === 'ACTA_EN_CURSO'
}

export function canSaveDraft(current: ActaLifecycleState): boolean {
  return current === 'ACTA_EN_CURSO'
}

export function canClose(current: ActaLifecycleState): boolean {
  return current === 'ACTA_EN_CURSO'
}

export function canReopen(current: ActaLifecycleState): boolean {
  return current === 'ACTA_CERRADA'
}

export function canFirstSave(current: ActaLifecycleState): boolean {
  return current === 'NO_EXISTE'
}

export function isTransitionAllowed(
  from: ActaLifecycleState,
  transition: ActaLifecycleTransition,
): boolean {
  switch (transition) {
    case 'FIRST_SAVE':
      return from === 'NO_EXISTE'
    case 'SAVE_DRAFT':
      return from === 'ACTA_EN_CURSO'
    case 'CLOSE':
      return from === 'ACTA_EN_CURSO'
    case 'REOPEN':
      return from === 'ACTA_CERRADA'
    default:
      return false
  }
}

export function targetStatusForTransition(
  transition: ActaLifecycleTransition,
): ActaDocumentStatus | null {
  switch (transition) {
    case 'FIRST_SAVE':
    case 'SAVE_DRAFT':
    case 'REOPEN':
      return 'ACTA_EN_CURSO'
    case 'CLOSE':
      return 'ACTA_CERRADA'
    default:
      return null
  }
}

export function assertLifecycleTransition(
  from: ActaLifecycleState,
  transition: ActaLifecycleTransition,
): void {
  if (!isTransitionAllowed(from, transition)) {
    throw new ActaLifecycleViolationError(
      `Transición no permitida: ${from} → ${transition}`,
      transition,
    )
  }
}

export function nextLifecycleAfterTransition(
  from: ActaLifecycleState,
  transition: ActaLifecycleTransition,
): ActaLifecycleState {
  assertLifecycleTransition(from, transition)
  const target = targetStatusForTransition(transition)
  if (target == null) {
    throw new ActaLifecycleViolationError(`Transición sin estado destino: ${transition}`, transition)
  }
  return target
}
