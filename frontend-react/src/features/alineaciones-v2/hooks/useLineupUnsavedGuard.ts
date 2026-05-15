import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TeamLineupDraftState } from '../components/TeamLineupContextPanel'
import { areLineupDraftsEqual } from '../utils/lineupDraftCompare'

export interface UseLineupUnsavedGuardOptions {
  readonly draft: TeamLineupDraftState | null
  readonly persistedSnapshot: TeamLineupDraftState | null
  readonly isLockedLineup: boolean
}

export interface UseLineupUnsavedGuardResult {
  readonly isDirty: boolean
  readonly showUnsavedModal: boolean
  readonly requestNavigation: (action: () => void) => void
  readonly continueEditing: () => void
  readonly leaveWithoutSaving: () => void
}

/**
 * Dirty state único: draft vs snapshot persistido.
 * Modal solo en navegación explícita (p. ej. «Volver al calendario»).
 * Refresh/cierre: beforeunload (diálogo nativo del navegador).
 */
export function useLineupUnsavedGuard({
  draft,
  persistedSnapshot,
  isLockedLineup,
}: UseLineupUnsavedGuardOptions): UseLineupUnsavedGuardResult {
  const pendingNavRef = useRef<(() => void) | null>(null)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)

  const isDirty = useMemo(() => {
    if (isLockedLineup || !draft || !persistedSnapshot) {
      return false
    }
    return !areLineupDraftsEqual(draft, persistedSnapshot)
  }, [draft, persistedSnapshot, isLockedLineup])

  useEffect(() => {
    if (!isDirty) {
      return
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [isDirty])

  const requestNavigation = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action()
        return
      }
      pendingNavRef.current = action
      setShowUnsavedModal(true)
    },
    [isDirty],
  )

  const continueEditing = useCallback(() => {
    setShowUnsavedModal(false)
    pendingNavRef.current = null
  }, [])

  const leaveWithoutSaving = useCallback(() => {
    setShowUnsavedModal(false)
    const pending = pendingNavRef.current
    pendingNavRef.current = null
    pending?.()
  }, [])

  return {
    isDirty,
    showUnsavedModal,
    requestNavigation,
    continueEditing,
    leaveWithoutSaving,
  }
}
