import { createCapabilities } from '@/contracts/capabilities.contract'
import type { GasAuthLoginV2Failure, GasAuthLoginV2Success } from '@/contracts/auth.contract'

const LOCAL_DEV_CREDENTIAL_HINT = 'local-dev'

/**
 * Respuesta wire de `auth_login_v2` para QA local (sin GAS).
 * Cualquier credencial no vacía autentica; vacía → rechazo.
 */
export function mockAuthLoginV2Response(credential: unknown): GasAuthLoginV2Success | GasAuthLoginV2Failure {
  const clave = typeof credential === 'string' ? credential.trim() : ''
  if (!clave) {
    return {
      version: 2,
      authenticated: false,
      error: { code: 'AUTH_EMPTY', message: 'Indica una credencial.' },
    }
  }

  const useHintId = clave === LOCAL_DEV_CREDENTIAL_HINT

  const success: GasAuthLoginV2Success = {
    version: 2,
    authenticated: true,
    user: {
      id: useHintId ? LOCAL_DEV_CREDENTIAL_HINT : `local-${clave.slice(0, 24)}`,
      role: 'staff',
      level: 99,
      displayName: useHintId ? 'Usuario desarrollo local' : `Dev (${clave})`,
    },
    capabilities: createCapabilities({
      canAccessMenu: true,
      canAccessCalendar: true,
      canManageTeam: true,
      canAccessActa: true,
    }),
  }

  return success
}

export { LOCAL_DEV_CREDENTIAL_HINT }
