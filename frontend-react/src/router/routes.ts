/** Rutas públicas de la SPA (sin prefijo legacy). */
export const ROUTES = {
  home: '/',
  login: '/login',
  menu: '/menu',
  calendar: '/calendar',
} as const

export type AppRoutePath = (typeof ROUTES)[keyof typeof ROUTES]
