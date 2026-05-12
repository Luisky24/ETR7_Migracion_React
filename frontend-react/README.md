# ETR7 — Frontend React (`frontend-react`)

## Propósito

Aplicación **SPA independiente** (Vite + React + TypeScript) para la migración progresiva de ETR7 hacia un frontend moderno. Convive con el sistema legacy **sin** vivir dentro de él: no usa el router legacy, no usa `web.html` ni includes legacy.

## Stack aprobado (foundation)

- React 19 + **TypeScript** (strict)
- Vite 8
- React Router 7 (`BrowserRouter` en local; **`HashRouter`** en build GAS — ver abajo)
- React Context (`SessionProvider` / sesión real)
- TailwindCSS + PostCSS
- ESLint (flat) + typescript-eslint
- Prettier (+ `eslint-config-prettier`)

## Relación con el legacy

- Código legacy: `../../ETRugby7` (Apps Script / HtmlService / patrones actuales).
- Este proyecto: solo en `ETR7_Migracion_React/frontend-react`.
- No se modifica el legacy desde aquí. El contrato array de `validarUsuario` lo reproduce el host independiente `../gas-webapp-react/` hasta unificar backend.

## Filosofía de desacoplamiento

```txt
React (UI)  →  services  →  adapters  →  gasTransport  →  google.script.run  →  GAS
```

- `google.script.run` existe **solo** en `src/transport/gasTransport.ts`.
- Arrays legacy de login solo se interpretan en `src/adapters/authAdapter.ts`.
- La SPA no importa HtmlService ni plantillas GAS.

## Estructura relevante

```txt
frontend-react/
├── scripts/
│   └── sync-gas-webapp.mjs   # post-build → ../gas-webapp-react/Assets_*.html
├── src/
│   ├── adapters/
│   ├── contexts/
│   ├── contracts/
│   ├── pages/
│   ├── router/
│   ├── services/
│   ├── transport/
│   └── ...
├── .env.gas                  # VITE_ROUTER_MODE=hash (solo modo `gas`)
├── vite.config.ts            # `base` + bundle único en modo `gas`
└── package.json
```

## Cómo arrancar (local)

Requisitos: Node 18+ (probado con Node 22).

```bash
cd ETR7_Migracion_React/frontend-react
npm install
npm run dev
```

Navegación local: rutas sin hash (`/`, `/login`, `/menu`).

Calidad:

```bash
npm run lint
npm run format
npm run format:check
```

Build estándar (p. ej. hosting estático con rutas HTTP):

```bash
npm run build
npm run preview
```

## Build para Google Apps Script

Genera el bundle optimizado para HtmlService y escribe los fragmentos en el proyecto hermano **`../gas-webapp-react/`**:

```bash
npm run build:gas
```

Pasos típicos después:

1. Copiar o subir con [clasp](https://github.com/google/clasp) **todos** los archivos de `gas-webapp-react/` (incluidos `Assets_js.html` y `Assets_css.html` generados).
2. En Apps Script: **Implementar** → **Aplicación web** y abrir la URL.

Documentación detallada: [`../docs/gas-webapp.md`](../docs/gas-webapp.md) y [`../gas-webapp-react/README.md`](../gas-webapp-react/README.md).

### Por qué HashRouter en GAS

HtmlService no reescribe rutas del servidor para `/login` o `/menu`. Sin hash, un refresco en una ruta profunda devuelve 404. El modo `gas` activa `VITE_ROUTER_MODE=hash` (`.env.gas`): en producción GAS las rutas son `#/`, `#/login`, `#/menu`.

## Rutas (conceptuales)

| Ruta     | Descripción                          |
| -------- | ------------------------------------ |
| `/`      | Inicio                               |
| `/login` | Login → `validarUsuario` vía adapter |
| `/menu`  | Placeholder de menú (sesión requerida) |

En Web App GAS, anteponer `#` a la ruta (p. ej. `#/login`).

## Restricciones / notas

- Fuera del iframe de Apps Script, `google.script.run` no existe: login fallará con error de transporte (esperado en `npm run dev` sin mock).
- Tamaño del bundle: Apps Script impone límites por archivo; vigilar el tamaño de `Assets_js.html` tras cada build.

## Próximos pasos sugeridos

- Automatizar despliegue (clasp + CI) cuando el flujo manual esté validado.
- Unificar `validarUsuario` en un solo backend cuando el legacy deje de ser necesario.
