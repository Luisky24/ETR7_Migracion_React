import { log } from '@/core/debug'
import { err, ok } from '@/contracts/context.contract'
import { createCapabilities, type UserCapabilities } from '@/contracts/capabilities.contract'
import type { AuthLoginData, AuthLoginRequest, AuthLoginResponse, AuthRole } from '@/contracts/auth.contract'
import { gasTransport } from '@/transport/gasTransport'

const GAS_FUNCTION_VALIDAR_USUARIO = 'validarUsuario'

/**
 * Niveles numéricos del host legacy (solo en este adapter).
 * Centralizados para evitar comparaciones dispersas con literales.
 */
const LEGACY_ACCESS_LEVEL = {
  ARBITRO: 5,
  TEAM: 7,
  STAFF: 10,
  LCV: 20,
} as const

const LEGACY_LEVEL_TO_ROLE: Readonly<Record<number, AuthRole>> = {
  [LEGACY_ACCESS_LEVEL.STAFF]: 'staff',
  [LEGACY_ACCESS_LEVEL.LCV]: 'lcv',
  [LEGACY_ACCESS_LEVEL.ARBITRO]: 'arbitro',
  [LEGACY_ACCESS_LEVEL.TEAM]: 'team',
}

/** Fila legacy devuelta por GAS: solo se interpreta dentro de este módulo. */
type LegacyValidarUsuarioRow = readonly unknown[]

function isLegacyRow(value: unknown): value is LegacyValidarUsuarioRow {
  return Array.isArray(value) && value.length >= 2
}

function mapLegacyLevelToRole(nivel: number): AuthRole | null {
  const role = LEGACY_LEVEL_TO_ROLE[nivel]
  return role ?? null
}

function capabilitiesForRole(role: AuthRole): UserCapabilities {
  switch (role) {
    case 'staff':
      return createCapabilities({
        canAccessMenu: true,
        canAccessCalendar: true,
        canManageTeam: true,
      })
    case 'lcv':
      return createCapabilities({
        canAccessMenu: true,
        canAccessCalendar: true,
        canManageTeam: true,
      })
    case 'arbitro':
      return createCapabilities({
        canAccessMenu: true,
        canAccessCalendar: true,
        canManageTeam: false,
      })
    case 'team':
      return createCapabilities({
        canAccessMenu: true,
        canAccessCalendar: true,
        canManageTeam: false,
      })
  }
}

function displayNameFor(role: AuthRole, team?: { maleTeamLabel: string; femaleTeamLabel: string }): string {
  switch (role) {
    case 'staff':
      return 'Staff'
    case 'lcv':
      return 'LCV'
    case 'arbitro':
      return 'Árbitro'
    case 'team': {
      const parts = [team?.maleTeamLabel, team?.femaleTeamLabel].filter((x) => x && x !== 'NO') as string[]
      const unique = [...new Set(parts)]
      return unique.length > 0 ? unique.join(' / ') : 'Equipo'
    }
    default:
      return 'Usuario'
  }
}

function parseLegacyRow(row: LegacyValidarUsuarioRow): AuthLoginResponse {
  const code = row[0]
  const nivelRaw = row[1]

  if (code === 'KO') {
    return err({ code: 'AUTH_INVALID', message: 'Credencial no válida.' })
  }

  if (code !== 'OK') {
    return err({ code: 'AUTH_UNKNOWN', message: 'Respuesta de autenticación no reconocida.' })
  }

  if (typeof nivelRaw !== 'number' || !Number.isFinite(nivelRaw)) {
    return err({ code: 'AUTH_MALFORMED', message: 'Nivel de acceso inválido.' })
  }

  const role = mapLegacyLevelToRole(nivelRaw)
  if (!role) {
    return err({ code: 'AUTH_ROLE_UNKNOWN', message: 'Rol no soportado para este cliente.' })
  }

  let team: AuthLoginData['team']
  if (role === 'team') {
    const male = row[2]
    const female = row[3]
    if (typeof male !== 'string' || typeof female !== 'string') {
      return err({ code: 'AUTH_MALFORMED', message: 'Datos de equipo incompletos.' })
    }
    team = { maleTeamLabel: male, femaleTeamLabel: female }
  }

  const data: AuthLoginData = {
    role,
    capabilities: capabilitiesForRole(role),
    displayName: displayNameFor(role, team),
    ...(team ? { team } : {}),
  }

  return ok(data)
}

/**
 * Adapta `validarUsuario` (GAS) al contrato tipado de la SPA. Ningún array legacy sale de aquí.
 */
export async function authLogin(request: AuthLoginRequest): Promise<AuthLoginResponse> {
  const clave = request.credential.trim()
  if (!clave) {
    return err({ code: 'AUTH_EMPTY', message: 'Indica una credencial.' })
  }

  try {
    log.debug('auth.login.call', { fn: GAS_FUNCTION_VALIDAR_USUARIO })
    const raw: unknown = await gasTransport.call(GAS_FUNCTION_VALIDAR_USUARIO, clave)
    if (!isLegacyRow(raw)) {
      log.warn('auth.login.malformedResponse', {})
      return err({ code: 'AUTH_MALFORMED', message: 'Formato de respuesta inesperado.' })
    }
    const parsed = parseLegacyRow(raw)
    if (!parsed.ok) {
      log.warn('auth.login.rejected', { code: parsed.error.code })
    } else {
      log.debug('auth.login.ok', { role: parsed.data.role })
    }
    return parsed
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al contactar con el servidor.'
    log.warn('auth.login.transport', { message })
    return err({ code: 'AUTH_TRANSPORT', message })
  }
}
