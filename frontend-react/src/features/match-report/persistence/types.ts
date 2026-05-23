export interface ActaDocumentValidationIssue {
  readonly code: string
  readonly message: string
  /** Referencia invariante F1–F26. */
  readonly invariantId?: string
}

export interface ActaDocumentValidationResult {
  readonly ok: boolean
  readonly issues: readonly ActaDocumentValidationIssue[]
}

export class ActaLifecycleViolationError extends Error {
  readonly transition: string

  constructor(message: string, transition: string) {
    super(message)
    this.name = 'ActaLifecycleViolationError'
    this.transition = transition
  }
}
