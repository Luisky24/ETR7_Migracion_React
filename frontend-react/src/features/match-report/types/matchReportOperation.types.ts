/** Estados operacionales explícitos del runtime Acta (FASE 3). */
export type MatchReportOperationStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'saving'
  | 'saved'
  | 'finalizing'
  | 'finalized'
  | 'locked'
  | 'error'

export type OperationErrorCategory = 'domain' | 'validation' | 'infrastructure' | 'wire'

/** Error normalizado para UI y política de recuperación. */
export interface NormalizedOperationError {
  readonly code: string
  readonly userMessage: string
  readonly technicalMessage: string
  readonly category: OperationErrorCategory
  readonly recoverable: boolean
  readonly retryable: boolean
  readonly shouldReload: boolean
  readonly shouldBlock: boolean
}

/** Pistas de recuperación tras fallo (dirty preservado cuando aplique). */
export interface RecoveryHints {
  readonly canRetrySave: boolean
  readonly canRetryFinalize: boolean
  readonly canReload: boolean
  readonly preserveDirty: boolean
}
