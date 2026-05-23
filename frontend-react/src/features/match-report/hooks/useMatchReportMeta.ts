import { useCallback, useMemo } from 'react'
import type { TeamSide } from '../contracts'
import { useMatchReportContext } from '../context/useMatchReportContext'
import { selectCanEdit, selectDirtyFieldKeys } from '../selectors/matchReportUiSelectors'
import {
  INCIDENCIAS_FIELD_KEY,
  REFEREE_FIELD_KEY,
  teamObservationsFieldKey,
} from '../types/matchReportForm.types'
import { refereeDisplayName } from '../utils/referee'
import { useMatchReportActions } from './useMatchReportActions'

/** Campos de metadatos del acta: árbitro, incidencias y observaciones por equipo. */
export function useMatchReportMeta() {
  const { state } = useMatchReportContext()
  const { updateObservations, updateReferee } = useMatchReportActions()

  const report = state.report
  const canEdit = selectCanEdit(state)
  const dirtyFields = useMemo(() => selectDirtyFieldKeys(state), [state])

  const onRefereeChange = useCallback(
    (name: string) => {
      if (!canEdit) return
      updateReferee(name)
    },
    [canEdit, updateReferee],
  )

  const onIncidenciasChange = useCallback(
    (incidencias: string) => {
      if (!canEdit) return
      updateObservations({ incidencias })
    },
    [canEdit, updateObservations],
  )

  const onTeamObservationsChange = useCallback(
    (side: TeamSide, observaciones: string) => {
      if (!canEdit) return
      updateObservations({ side, observaciones })
    },
    [canEdit, updateObservations],
  )

  return useMemo(
    () => ({
      canEdit,
      refereeName: refereeDisplayName(report?.referee),
      incidencias: report?.incidencias ?? '',
      localObservaciones: report?.local.observaciones ?? '',
      visitObservaciones: report?.visitante.observaciones ?? '',
      isRefereeDirty: dirtyFields.has(REFEREE_FIELD_KEY),
      isIncidenciasDirty: dirtyFields.has(INCIDENCIAS_FIELD_KEY),
      isTeamObservationsDirty: (side: TeamSide) => dirtyFields.has(teamObservationsFieldKey(side)),
      onRefereeChange,
      onIncidenciasChange,
      onTeamObservationsChange,
    }),
    [
      canEdit,
      report,
      dirtyFields,
      onRefereeChange,
      onIncidenciasChange,
      onTeamObservationsChange,
    ],
  )
}
