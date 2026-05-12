import type { UserCapabilities } from './capabilities.contract'
import type { ContractError, ContractFailure, ContractSuccess, ContractResult } from './context.contract'

/**
 * Envelope API reutilizable (alias semánticos para la capa auth).
 */
export type ApiOk<T> = ContractSuccess<T>
export type ApiErr = ContractError
export type ApiFailure = ContractFailure
export type ApiResult<T> = ContractResult<T>

/** Roles de aplicación mapeados desde `nivelAcceso` legacy (solo en adapter). */
export type AuthRole = 'staff' | 'lcv' | 'arbitro' | 'team'

export interface AuthLoginRequest {
  /** Clave enviada a `validarUsuario` en GAS (legacy). */
  credential: string
}

export interface AuthTeamSnapshot {
  /** Etiqueta equipo masculino: nombre o "NO" si no aplica. */
  maleTeamLabel: string
  /** Etiqueta equipo femenino: nombre o "NO" si no aplica. */
  femaleTeamLabel: string
}

export interface AuthLoginData {
  role: AuthRole
  /** Permisos explícitos derivados del rol en el límite adapter → dominio. */
  capabilities: UserCapabilities
  displayName: string
  team?: AuthTeamSnapshot
}

export type AuthLoginResponse = ApiResult<AuthLoginData>
