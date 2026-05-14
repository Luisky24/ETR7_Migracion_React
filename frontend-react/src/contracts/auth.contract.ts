import type { UserCapabilities } from './capabilities.contract'
import type { ContractError, ContractFailure, ContractSuccess, ContractResult } from './context.contract'

/**
 * Envelope API reutilizable (alias semánticos para la capa auth).
 */
export type ApiOk<T> = ContractSuccess<T>
export type ApiErr = ContractError
export type ApiFailure = ContractFailure
export type ApiResult<T> = ContractResult<T>

/** Roles de aplicación (literales alineados con `auth_login_v2` en GAS). */
export type AuthRole = 'staff' | 'lcv' | 'arbitro' | 'team'

export interface AuthLoginRequest {
  /** Clave enviada a `auth_login_v2` en GAS (boundary oficial). */
  credential: string
}

export interface AuthTeamSnapshot {
  /** Etiqueta equipo masculino: nombre o "NO" si no aplica (alineado con hoja inscripciones). */
  maleTeamLabel: string
  /** Etiqueta equipo femenino: nombre o "NO" si no aplica. */
  femaleTeamLabel: string
}

export interface AuthLoginData {
  /** Identificador estable asignado por GAS (`user.id` del boundary). */
  userId: string
  role: AuthRole
  /** Permisos explícitos según servidor (sin derivación en React). */
  capabilities: UserCapabilities
  displayName: string
  team?: AuthTeamSnapshot
}

/** Respuesta estable `auth_login_v2` (GAS) — éxito. */
export interface GasAuthLoginV2Success {
  readonly version: 2
  readonly authenticated: true
  readonly user: {
    readonly id: string
    /** Tras validación en adapter (`isAuthRole`); el wire JSON llega como string. */
    readonly role: AuthRole
    readonly level: number
    readonly displayName: string
  }
  readonly capabilities: UserCapabilities
  readonly team?: {
    readonly masculina?: string
    readonly femenina?: string
  }
}

/** Respuesta estable `auth_login_v2` (GAS) — fallo. */
export interface GasAuthLoginV2Failure {
  readonly version: 2
  readonly authenticated: false
  readonly error: {
    readonly code: string
    readonly message: string
  }
}

export type GasAuthLoginV2Response = GasAuthLoginV2Success | GasAuthLoginV2Failure

export type AuthLoginResponse = ApiResult<AuthLoginData>
