import type { UserCapabilities } from './capabilities.contract'
import type { AuthRole, AuthTeamSnapshot } from './auth.contract'

/**
 * Estado de sesión en memoria (UI / dominio). La persistencia controlada vive en sessionStorage
 * y es orquestada por SessionContext — este contrato describe solo la forma en React.
 */

export type SessionStatus = 'guest' | 'authenticated'

export interface SessionUser {
  id: string
  displayName: string
  role: AuthRole
  capabilities: UserCapabilities
  team?: AuthTeamSnapshot
}

export interface SessionGuestState {
  status: 'guest'
  user: null
}

export interface SessionAuthenticatedState {
  status: 'authenticated'
  user: SessionUser
}

export type SessionState = SessionGuestState | SessionAuthenticatedState

export const defaultSessionState: SessionGuestState = {
  status: 'guest',
  user: null,
}

/**
 * Fases de lifecycle tras resolver la sesión en el primer render (lectura síncrona de sessionStorage).
 * No hay fase intermedia: el estado inicial ya es `guest` o `authenticated`.
 */
export type SessionLifecycle = 'guest' | 'authenticated'
