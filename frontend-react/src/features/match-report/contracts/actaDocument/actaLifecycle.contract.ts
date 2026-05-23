/**
 * Lifecycle documental del acta JSON.
 * `NO_EXISTE` es estado de repositorio; no se persiste en el documento.
 */

export type ActaLifecycleState = 'NO_EXISTE' | 'ACTA_EN_CURSO' | 'ACTA_CERRADA'

/** Estados persistidos en `ActaDocumentMetadata.status`. */
export type ActaDocumentStatus = Extract<ActaLifecycleState, 'ACTA_EN_CURSO' | 'ACTA_CERRADA'>

export type ActaLifecycleTransition =
  | 'FIRST_SAVE'
  | 'SAVE_DRAFT'
  | 'CLOSE'
  | 'REOPEN'
