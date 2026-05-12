# ETR7 React — Checklist validación manual (React ↔ GAS)

Objetivo: validar el ciclo completo **UI → hook → service → adapter → transport → GAS** antes de seguir migrando.

## Entorno

1. Desde `ETR7_Migracion_React/frontend-react`:
   - `npm run build:gas` — debe generar `../gas-webapp-react/Assets_js.html` y `Assets_css.html`.
2. Copiar o desplegar **toda** la carpeta `gas-webapp-react` al proyecto Apps Script del host React.
3. Publicar / abrir la **Web App**; la SPA usa **HashRouter** (`#/`, `#/login`, `#/menu`, `#/calendar`).
4. Consola del navegador abierta (F12) para logs:
   - Con `VITE_ETR7_DEBUG=true` en el build (o entorno **desarrollo**): logs `debug` / `warn` / `error` con prefijo `[ETR7]` desde `@/core/debug`.
   - Fallos de **transporte** (`google.script.run`): siempre `console.error` con prefijo `[ETR7]` vía `logTransportFailure` (no dependen del flag).

## Login

| # | Caso | Pasos | Esperado |
|---|------|-------|----------|
| L1 | Login correcto | `#/login`, credencial válida, Entrar | Redirección a `#/menu`; consola: `auth.login.ok`, `session.login.success`. |
| L2 | Login incorrecto | Credencial inválida | Mensaje de error en pantalla; consola: `auth.login.rejected` o similar; **no** navega a menú. |
| L3 | Transporte / host | Abrir la SPA **fuera** del iframe GAS (p. ej. `npm run preview` sin mock) | Error visible; consola: `gasTransport.missingHost` o fallo de función; login muestra mensaje genérico de conexión si hay excepción no controlada en capa sesión. |

## Sesión

| # | Caso | Pasos | Esperado |
|---|------|-------|----------|
| S1 | Bootstrap | Recargar con sesión persistida | Estado autenticado coherente; consola (si debug ON): `session.bootstrap` una vez por montaje del provider. |
| S2 | Refresh navegador | En `#/menu` o `#/calendar`, F5 | Sesión restaurada desde `sessionStorage` (misma UX que antes del refresh). |
| S3 | Logout | Cerrar sesión desde menú | Navegación a `#/login`; consola: `session.logout`. |

## Calendario (solo lectura)

| # | Caso | Pasos | Esperado |
|---|------|-------|----------|
| C1 | Carga inicial | `#/calendar` con permiso `canAccessCalendar` | Loading breve; tabla o vacío; consola (debug): `calendar.getMatches.start` / `calendar.getMatches.ok` con `rowCount`. |
| C2 | Cambio categoría | M ↔ F | Nueva petición; datos coherentes con categoría. |
| C3 | Cambio fase | Fase I ↔ Fase II | Nueva petición; sin errores de consola salvo fallo real GAS. |
| C4 | Refrescar | Botón Refrescar | Re-fetch; loading en filtros/botón. |
| C5 | Error backend | Simular fallo (red, función no desplegada) | `CalendarErrorState` + Reintentar; consola: `calendar.getMatches.error` (debug) y/o `gasTransport.*` (siempre en fallo de transport). |

## Routing

| # | Caso | Pasos | Esperado |
|---|------|-------|----------|
| R1 | Ruta protegida | Sin sesión, ir a `#/calendar` | `AuthGuard` redirige a login (o comportamiento definido en `AUTH_REDIRECTS`). |
| R2 | Acceso directo | URL `#/calendar` autenticado + capability | Página calendario. |
| R3 | Sin capability | Usuario sin `canAccessCalendar` | Redirección a `#/menu` desde la página calendario. |
| R4 | Redirect login OK | Tras login correcto | `#/menu` (replace). |

## GAS / Web App

| # | Caso | Esperado |
|---|------|----------|
| G1 | Carga Web App | `ReactHost.html` incluye bundle; `#root` monta sin error en consola. |
| G2 | Funciones expuestas | `validarUsuario`, `obtenerDatosInformacion` disponibles en el proyecto script enlazado al host. |

## Regresión rápida

- [ ] `npm run lint` y `npm run build` en `frontend-react` sin errores.
- [ ] Ningún `console.log` nuevo disperso en componentes de UI (solo `@/core/debug` y `logTransportFailure` en transporte).
