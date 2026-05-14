import { ROUTES } from '@/router/routes'

/**
 * Modelo de navegación: rutas públicas vs protegidas y destinos de redirect.
 * Los guards consumen estas constantes; no contienen lógica de backend.
 */

export const PUBLIC_ROUTE_PATHS = [ROUTES.home, ROUTES.login] as const

/** Rutas que exigen `AuthGuard` en `AppRouter` — única lista de referencia para ownership. */
export const PROTECTED_ROUTE_PATHS = [ROUTES.menu, ROUTES.calendar, ROUTES.calendarLineups] as const

export type PublicRoutePath = (typeof PUBLIC_ROUTE_PATHS)[number]
export type ProtectedRoutePath = (typeof PROTECTED_ROUTE_PATHS)[number]

export const AUTH_REDIRECTS = {
  /** Tras login exitoso o cuando un usuario autenticado entra en /login. */
  postLogin: ROUTES.menu,
  /** Cuando un invitado intenta una ruta protegida. */
  requireAuth: ROUTES.login,
} as const
