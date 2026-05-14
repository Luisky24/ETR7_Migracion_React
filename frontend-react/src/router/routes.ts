/** Rutas públicas de la SPA (sin prefijo legacy). */
export const ROUTES = {
  home: '/',
  login: '/login',
  menu: '/menu',
  calendar: '/calendar',
  /** Alineaciones read-only; query: `categoria`, `fase`, `rk` (clave de registro calendario). */
  calendarLineups: '/calendar/lineups',
  /** Contexto operativo por equipo (boundary v2); query: `categoria`, `fase`, `rk`, `equipo`, snapshot opcional. */
  calendarTeamLineupContext: '/calendar/team-lineup-context',
} as const

export type AppRoutePath = (typeof ROUTES)[keyof typeof ROUTES]
