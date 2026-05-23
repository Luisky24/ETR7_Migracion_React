import { useEffect, useRef } from 'react'
import type { MatchReportOperationStatus } from '../types/matchReportOperation.types'
import { focusFirstActionInput, restoreActionInputFocus } from '../presentation/smartEntryFocus'

export interface UseMatchReportEntryFocusOptions {
  readonly operation: MatchReportOperationStatus
  readonly canEdit: boolean
  readonly readOnly: boolean
  readonly reportReady: boolean
}

/**
 * Foco contextual: primera celda al cargar; restauración tras guardar o cerrar modales.
 */
export function useMatchReportEntryFocus({
  operation,
  canEdit,
  readOnly,
  reportReady,
}: UseMatchReportEntryFocusOptions): void {
  const didInitialFocusRef = useRef(false)
  const prevOperationRef = useRef<MatchReportOperationStatus>(operation)

  useEffect(() => {
    if (!reportReady || readOnly || !canEdit) return

    const prev = prevOperationRef.current
    prevOperationRef.current = operation

    if (!didInitialFocusRef.current && (operation === 'loaded' || operation === 'saved')) {
      didInitialFocusRef.current = true
      requestAnimationFrame(() => {
        focusFirstActionInput('local')
      })
      return
    }

    if (prev === 'saving' && operation === 'saved') {
      requestAnimationFrame(() => {
        restoreActionInputFocus() || focusFirstActionInput('local')
      })
    }

    if (prev === 'error' && operation === 'loaded' && didInitialFocusRef.current) {
      requestAnimationFrame(() => {
        restoreActionInputFocus()
      })
    }
  }, [operation, canEdit, readOnly, reportReady])
}

/** Restaura foco en celda de acciones (p. ej. al cerrar modal). */
export function scheduleRestoreActionFocus(): void {
  requestAnimationFrame(() => {
    restoreActionInputFocus()
  })
}
