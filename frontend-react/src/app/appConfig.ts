/**
 * Configuración global mínima de la aplicación.
 * Ampliar aquí (p. ej. flags, límites) sin acoplar a legacy ni GAS.
 */
export const appConfig = {
  appName: 'ETR7',
  /** Base path si en el futuro la SPA se sirve bajo subruta (p. ej. /app/) */
  basePath: '/' as const,
} as const
