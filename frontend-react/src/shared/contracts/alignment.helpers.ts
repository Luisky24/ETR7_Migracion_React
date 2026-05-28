/**
 * Helpers puros del agregado AlignmentDocumentV1 (ETR7).
 * Sin I/O, sin runtime React, sin persistencia.
 */

import type { AlignmentDocumentV1, AlignmentLifecycleState } from './alignment.document'

/**
 * Revisión monotónica de cierre (1,2,3...).
 * - Inicia en 1 si no existe cierre previo.
 * - Sobrevive reopen (se basa en `closure.closeRevision`).
 */
export function nextCloseRevision(doc: Pick<AlignmentDocumentV1, 'closure'>): number {
  const prev = doc.closure?.closeRevision ?? 0
  return prev + 1
}

/**
 * Deriva estado actual a partir del history (si existe).
 * La fuente primaria es `lifecycle.history.at(-1).to` cuando hay transiciones.
 */
export function deriveAlignmentLifecycleState(
  lifecycle: Pick<AlignmentDocumentV1, 'lifecycle'>['lifecycle'],
): AlignmentLifecycleState {
  const last = lifecycle.history.at(-1)
  return last?.to ?? lifecycle.state
}

