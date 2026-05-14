import type { CalendarCategory } from '@/features/calendar/contracts/calendar.contract'
import type { SessionUser } from '@/contracts/session.contract'

/**
 * Nombre de equipo operativo en sesión (legacy) para la categoría del calendario.
 * Usa etiquetas masculino/femenino devueltas por auth (p. ej. "NO" si no aplica).
 */
export function sessionOperationalTeamName(
  user: SessionUser,
  categoria: CalendarCategory,
): string | null {
  if (user.role !== 'team' || !user.team) {
    return null
  }
  const { maleTeamLabel, femaleTeamLabel } = user.team
  if (categoria === 'M') {
    if (maleTeamLabel && maleTeamLabel !== 'NO') {
      return maleTeamLabel.trim()
    }
    if (femaleTeamLabel && femaleTeamLabel !== 'NO') {
      return femaleTeamLabel.trim()
    }
  } else {
    if (femaleTeamLabel && femaleTeamLabel !== 'NO') {
      return femaleTeamLabel.trim()
    }
    if (maleTeamLabel && maleTeamLabel !== 'NO') {
      return maleTeamLabel.trim()
    }
  }
  return null
}
