# Integración SPA React ↔ Google Apps Script

## Objetivo

Servir el build de Vite/React desde un **proyecto Apps Script dedicado** (`gas-webapp-react/`), sin mezclar con `web.html` ni el router legacy de `ETRugby7`. GAS actúa solo como **host HtmlService** y **backend** (`validarUsuario`).

## Flujo

```txt
npm run build:gas   (en frontend-react)
        ↓
dist/  (Vite, modo gas: base relativo, bundle único)
        ↓
scripts/sync-gas-webapp.mjs
        ↓
gas-webapp-react/Assets_js.html + Assets_css.html
        ↓
Proyecto Apps Script (editor o clasp) + Implementar como aplicación web
        ↓
Usuario abre URL → ReactHost → SPA → gasTransport → google.script.run → validarUsuario
```

## Rutas en Web App

HtmlService no reescribe rutas HTTP para la SPA. Por eso el build GAS usa **`HashRouter`** (`#/login`, `#/menu`) vía `VITE_ROUTER_MODE=hash` en `.env.gas`. El desarrollo local por defecto sigue usando `BrowserRouter`.

## Desacoplamiento

- El código en `frontend-react/src/` no importa HtmlService ni APIs de GAS salvo el transporte encapsulado.
- El legacy `ETRugby7` no se modifica; la validación duplicada en `gas-webapp-react/Validacion.gs` mantiene el mismo contrato array hasta unificar backend.

## Referencias

- README del host: `../gas-webapp-react/README.md`
- README del frontend: `../frontend-react/README.md`
