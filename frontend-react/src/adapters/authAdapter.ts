import { log } from '@/core/debug'
import { err, ok } from '@/contracts/context.contract'
import { createCapabilities, type UserCapabilities } from '@/contracts/capabilities.contract'
import type {
  AuthLoginData,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthRole,
  GasAuthLoginV2Success,
} from '@/contracts/auth.contract'
import { gasTransport } from '@/transport/gasTransport'

const GAS_AUTH_LOGIN_V2 = 'auth_login_v2'

const AUTH_ROLES: ReadonlySet<AuthRole> = new Set(['staff', 'lcv', 'arbitro', 'team'])

function isAuthRole(value: string): value is AuthRole {
  return AUTH_ROLES.has(value as AuthRole)
}

function isUserCapabilitiesLoose(value: unknown): value is Partial<UserCapabilities> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const o = value as Record<string, unknown>
  const keys: (keyof UserCapabilities)[] = [
    'canAccessMenu',
    'canAccessCalendar',
    'canManageTeam',
    'canAccessActa',
  ]
  for (const k of keys) {
    const v = o[k]
    if (v !== undefined && typeof v !== 'boolean') {
      return false
    }
  }
  return true
}

function normalizeCapabilitiesFromGas(caps: unknown): UserCapabilities {
  if (!isUserCapabilitiesLoose(caps)) {
    return createCapabilities({})
  }
  return createCapabilities(caps)
}

function adaptAuthV2Success(body: GasAuthLoginV2Success): AuthLoginResponse {
  const caps = normalizeCapabilitiesFromGas(body.capabilities)
  let team: AuthLoginData['team']
  if (body.team != null && typeof body.team === 'object') {
    const m = body.team.masculina
    const f = body.team.femenina
    if (typeof m === 'string' && typeof f === 'string') {
      team = { maleTeamLabel: m, femaleTeamLabel: f }
    }
  }

  if (body.user.role === 'team' && !team) {
    return err({ code: 'AUTH_MALFORMED', message: 'Datos de equipo incompletos.' })
  }

  const data: AuthLoginData = {
    userId: body.user.id,
    role: body.user.role,
    capabilities: caps,
    displayName: body.user.displayName,
    ...(team ? { team } : {}),
  }

  return ok(data)
}

/**
 * Interpreta la respuesta cruda de `auth_login_v2` (solo validación runtime).
 */
function parseAuthLoginV2Envelope(raw: unknown): AuthLoginResponse {
  if (raw == null || typeof raw !== 'object') {
    log.warn('auth.login.boundaryUnexpected', { reason: 'null_or_non_object' })
    return err({ code: 'AUTH_MALFORMED', message: 'Formato de respuesta inesperado.' })
  }

  const o = raw as Record<string, unknown>
  if (o.version !== 2) {
    log.warn('auth.login.boundaryUnexpected', { reason: 'bad_version', version: o.version })
    return err({ code: 'AUTH_MALFORMED', message: 'Formato de respuesta inesperado.' })
  }

  const authed = o.authenticated
  if (authed !== true && authed !== false) {
    log.warn('auth.login.boundaryUnexpected', { reason: 'bad_authenticated' })
    return err({ code: 'AUTH_MALFORMED', message: 'Formato de respuesta inesperado.' })
  }

  if (!authed) {
    const errObj = o.error
    if (typeof errObj !== 'object' || errObj === null) {
      log.warn('auth.login.boundaryUnexpected', { reason: 'failure_without_error' })
      return err({ code: 'AUTH_MALFORMED', message: 'Respuesta de error incompleta.' })
    }
    const er = errObj as Record<string, unknown>
    const code = typeof er.code === 'string' ? er.code : 'AUTH_INVALID'
    const message =
      typeof er.message === 'string' && er.message.trim() !== '' ? er.message : 'Credencial no válida.'
    log.warn('auth.login.rejected', { code })
    return err({ code, message })
  }

  const user = o.user
  if (typeof user !== 'object' || user === null) {
    log.warn('auth.login.boundaryUnexpected', { reason: 'success_without_user' })
    return err({ code: 'AUTH_MALFORMED', message: 'Respuesta de autenticación incompleta.' })
  }
  const u = user as Record<string, unknown>
  const capsRaw = o.capabilities

  if (
    typeof u.id !== 'string' ||
    typeof u.role !== 'string' ||
    typeof u.displayName !== 'string' ||
    typeof u.level !== 'number' ||
    !Number.isFinite(u.level)
  ) {
    log.warn('auth.login.boundaryUnexpected', { reason: 'user_fields_invalid' })
    return err({ code: 'AUTH_MALFORMED', message: 'Respuesta de autenticación incompleta.' })
  }

  if (!isAuthRole(u.role)) {
    log.warn('auth.login.boundaryUnexpected', { reason: 'unknown_role', role: u.role })
    return err({ code: 'AUTH_ROLE_UNKNOWN', message: 'Rol no soportado en este cliente.' })
  }

  const role: AuthRole = u.role

  let team: GasAuthLoginV2Success['team']
  const teamRaw = o.team
  if (teamRaw != null && typeof teamRaw === 'object') {
    const t = teamRaw as Record<string, unknown>
    const masculina = t.masculina
    const femenina = t.femenina
    if (typeof masculina === 'string' && typeof femenina === 'string') {
      team = { masculina, femenina }
    }
  }

  const successBody: GasAuthLoginV2Success = {
    version: 2,
    authenticated: true,
    user: {
      id: u.id,
      role,
      level: u.level,
      displayName: u.displayName,
    },
    capabilities: normalizeCapabilitiesFromGas(capsRaw),
    ...(team ? { team } : {}),
  }

  return adaptAuthV2Success(successBody)
}

/**
 * Adapta `auth_login_v2` (GAS) al contrato tipado de la SPA.
 */
export async function authLogin(request: AuthLoginRequest): Promise<AuthLoginResponse> {
  const clave = request.credential.trim()
  if (!clave) {
    return err({ code: 'AUTH_EMPTY', message: 'Indica una credencial.' })
  }

  try {
    log.debug('auth.login.call', { fn: GAS_AUTH_LOGIN_V2 })
    const raw: unknown = await gasTransport.call(GAS_AUTH_LOGIN_V2, clave)
    const parsed = parseAuthLoginV2Envelope(raw)
    if (parsed.ok) {
      log.debug('auth.login.ok', { role: parsed.data.role })
    }
    return parsed
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al contactar con el servidor.'
    log.warn('auth.login.transport', { message })
    return err({ code: 'AUTH_TRANSPORT', message })
  }
}
