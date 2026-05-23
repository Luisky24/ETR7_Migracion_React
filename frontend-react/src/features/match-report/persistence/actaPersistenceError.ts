import type { ActaPersistenceErrorCode } from '../contracts/actaDocument'
import type { ActaDocumentV1 } from '../contracts/actaDocument/actaDocument.contract'

export class ActaPersistenceError extends Error {
  readonly code: ActaPersistenceErrorCode

  constructor(code: ActaPersistenceErrorCode, message: string) {
    super(message)
    this.name = 'ActaPersistenceError'
    this.code = code
  }
}

export function cloneDocument(doc: ActaDocumentV1): ActaDocumentV1 {
  return JSON.parse(JSON.stringify(doc)) as ActaDocumentV1
}
