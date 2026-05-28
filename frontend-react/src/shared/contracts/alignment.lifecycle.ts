/**
 * Tabla formal de transiciones válidas del lifecycle AlignmentDocumentV1 (ETR7).
 * Se usa por `validateAlignmentDocument` para impedir estados/transiciones imposibles.
 */

import type { AlignmentLifecycleState } from './alignment.document'

export const ALIGNMENT_LIFECYCLE_STATES = [
  'DRAFT',
  'IN_PROGRESS',
  'CLOSED',
  'REOPENED',
] as const satisfies readonly AlignmentLifecycleState[]

export interface AlignmentLifecycleTransitionRule {
  readonly from: AlignmentLifecycleState
  readonly to: AlignmentLifecycleState
  readonly allowed: boolean
}

export const ALIGNMENT_LIFECYCLE_TRANSITIONS = [
  { from: 'DRAFT', to: 'IN_PROGRESS', allowed: true },
  { from: 'DRAFT', to: 'CLOSED', allowed: false },
  { from: 'DRAFT', to: 'REOPENED', allowed: false },

  { from: 'IN_PROGRESS', to: 'DRAFT', allowed: false },
  { from: 'IN_PROGRESS', to: 'CLOSED', allowed: true },
  { from: 'IN_PROGRESS', to: 'REOPENED', allowed: false },

  { from: 'CLOSED', to: 'REOPENED', allowed: true },
  { from: 'CLOSED', to: 'IN_PROGRESS', allowed: false },
  { from: 'CLOSED', to: 'DRAFT', allowed: false },

  { from: 'REOPENED', to: 'CLOSED', allowed: true },
  { from: 'REOPENED', to: 'IN_PROGRESS', allowed: false },
  { from: 'REOPENED', to: 'DRAFT', allowed: false },
] as const satisfies readonly AlignmentLifecycleTransitionRule[]

export function isAlignmentLifecycleTransitionAllowed(
  from: AlignmentLifecycleState,
  to: AlignmentLifecycleState,
): boolean {
  const rule = ALIGNMENT_LIFECYCLE_TRANSITIONS.find((r) => r.from === from && r.to === to)
  return rule?.allowed ?? false
}

