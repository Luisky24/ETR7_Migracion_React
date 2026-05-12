import { authLogin } from '@/adapters/authAdapter'
import type { AuthLoginRequest, AuthLoginResponse } from '@/contracts/auth.contract'

/**
 * Fachada de autenticación: orquesta adapters (GAS vía transport) sin UI.
 * La sesión en React la actualiza quien llame a `login` (p. ej. SessionContext).
 */
export const authService = {
  async login(request: AuthLoginRequest): Promise<AuthLoginResponse> {
    return authLogin(request)
  },

  /**
   * Fase mínima: sin invalidación remota. Reservado para futura revocación en servidor.
   */
  logout(): void {
    return
  },
} as const
