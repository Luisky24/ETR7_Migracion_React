import { useCallback, useMemo, useState } from 'react'
import type { TeamSide } from '../contracts'
import type { ActionFieldKey } from '../types/matchReportForm.types'
import { isOperationBusy } from '../domain/operationState'
import { teamConversionsExceedTriesMessage } from '../domain/validation'
import { useMatchReportContext } from '../context/useMatchReportContext'
import { playerActionFieldKey } from '../types/matchReportForm.types'
import { selectDirtyFieldKeys, selectCanEdit } from '../selectors/matchReportUiSelectors'
import { validateActionInputPatch } from '../validators/uiValidators'
import { useMatchReportStateRef } from './useMatchReportStateRef'

/**
 * Capa de formulario controlado: validación inmediata UI + dirty granular por campo.
 * El estado canónico del acta sigue en el reducer; aquí solo errores locales de input.
 */
export function useMatchReportForm() {
  const { state, dispatch } = useMatchReportContext()
  const stateRef = useMatchReportStateRef()
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({})

  const canEdit = selectCanEdit(state)
  const dirtyFields = useMemo(
    () => selectDirtyFieldKeys(state),
    [state.report, state.savedSnapshot, state.dirty],
  )

  const clearFieldError = useCallback((fieldKey: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldKey]) return prev
      const next = { ...prev }
      delete next[fieldKey]
      return next
    })
  }, [])

  const setFieldError = useCallback((fieldKey: string, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [fieldKey]: message }))
  }, [])

  const commitAction = useCallback(
    (side: TeamSide, playerId: string, field: ActionFieldKey, value: number) => {
      const fieldKey = playerActionFieldKey(side, playerId, field)
      if (!canEdit) return

      const patch = { [field]: value }
      const validationMessage = validateActionInputPatch(patch)
      if (validationMessage) {
        setFieldError(fieldKey, validationMessage)
        return
      }
      clearFieldError(fieldKey)
      if (isOperationBusy(stateRef.current.operation)) return
      dispatch({ type: 'UPDATE_ACTIONS', payload: { side, playerId, patch } })
    },
    [canEdit, clearFieldError, dispatch, setFieldError, stateRef],
  )

  const handleActionInputChange = useCallback(
    (side: TeamSide, playerId: string, field: ActionFieldKey, raw: string) => {
      const parsed = raw.trim() === '' ? 0 : parseInt(raw, 10)
      const value = Number.isFinite(parsed) ? parsed : 0
      commitAction(side, playerId, field, value)
    },
    [commitAction],
  )

  const isFieldDirty = useCallback(
    (side: TeamSide, playerId: string, field: ActionFieldKey) => {
      return dirtyFields.has(playerActionFieldKey(side, playerId, field))
    },
    [dirtyFields],
  )

  const getFieldError = useCallback(
    (side: TeamSide, playerId: string, field: ActionFieldKey) => {
      const fieldKey = playerActionFieldKey(side, playerId, field)
      const local = fieldErrors[fieldKey]
      if (local) return local

      if (field === 'E' || field === 'T') {
        const team = side === 'local' ? state.report?.local : state.report?.visitante
        if (team) {
          return teamConversionsExceedTriesMessage(team)
        }
      }
      return null
    },
    [fieldErrors, state.report],
  )

  return useMemo(
    () => ({
      canEdit,
      dirtyFields,
      dirtyCount: dirtyFields.size,
      fieldErrors,
      commitAction,
      handleActionInputChange,
      isFieldDirty,
      getFieldError,
    }),
    [
      canEdit,
      dirtyFields,
      fieldErrors,
      commitAction,
      handleActionInputChange,
      isFieldDirty,
      getFieldError,
    ],
  )
}
