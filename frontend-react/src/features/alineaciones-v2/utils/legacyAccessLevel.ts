import type { AuthRole } from '@/contracts/auth.contract'

/** Niveles legacy alineados con `validarUsuario` / Phase1. */
export function legacyNivelAccesoFromRole(role: AuthRole): number {
  switch (role) {
    case 'staff':
      return 10
    case 'lcv':
      return 20
    case 'arbitro':
      return 5
    case 'team':
      return 7
    default:
      return 0
  }
}
