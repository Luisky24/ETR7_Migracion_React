# ETR7 — Despliegue staging JSON/hybrid (datos federativos reales)

Guía operacional para pruebas con **Drive, Sheets y GAS reales**. No sustituye `docs/ACTAS_JSON_OPERATIONAL_CHECKLIST.md`.

---

## Build correcto

Desde `ETR7_Migracion_React/frontend-react`:

```bash
npm run build:gas
```

El script ejecuta `vite build --mode gas` (carga **`.env.gas`**) y sincroniza assets a `gas-webapp-react/`.  
Para validación TypeScript estricta adicional: `npm run build:gas:check`.

Variables en **`.env.gas`**:

```env
VITE_ROUTER_MODE=hash
VITE_ETR7_ACTA_PERSISTENCE=hybrid
VITE_ETR7_DEBUG=false
VITE_ETR7_STAGING=true
```

Equivalente explícito (si se sobreescribe env):

```bash
VITE_ETR7_ACTA_PERSISTENCE=hybrid \
VITE_ETR7_DEBUG=false \
VITE_ETR7_STAGING=true \
npm run build:gas
```

Salida: `dist/` → sincronizado a `../gas-webapp-react/Assets_js.html` y `Assets_css.html`.

---

## Despliegue GAS

1. Copiar o sincronizar la carpeta **`gas-webapp-react`** completa al proyecto Apps Script del host React.
2. Verificar que existen hosts: `actaJson_*`, `calendarSync_applyBundle`, `obtenerAlineacionesSPA`, etc.
3. Publicar / abrir la **Web App** (iframe HtmlService).
4. Confirmar en consola del navegador (F12) al cargar:

```txt
[ETR7 Runtime] MODE=gas Persistence=hybrid CalendarSync=real ActaRepository=Drive
```

5. Banner superior visible: **ETR7 STAGING — JSON/HYBRID · NO PRODUCCIÓN**.

---

## Runtime correcto

| Requisito | Esperado |
|-----------|----------|
| `import.meta.env.MODE` | `gas` |
| Persistencia | `hybrid` o `json` |
| Transporte | `google.script.run` presente |
| Match report service | `gas` (no mock) |
| Acta JSON | `DriveGasActaDocumentStore` → GAS real |
| Calendar sync | `calendarSync_applyBundle` GAS real |
| Idempotencia sync | `CacheService` en host GAS |

---

## Checklist validación previa (piloto)

- [ ] Login con credencial **federativa real** (no `local-dev`, sin banner “modo desarrollo local”).
- [ ] Calendario muestra encuentros **reales** (no equipos `LOCAL M` / `VISIT M` de mock).
- [ ] Abrir acta: bootstrap hybrid (JSON si existe, si no legacy alineaciones).
- [ ] Save draft: archivo JSON en Drive, `documentVersion` incrementa.
- [ ] Close: JSON `ACTA_CERRADA` + Calendario `acta_cerrada` + Resultados.
- [ ] Logs GAS: `[calendarSyncHost]` sin error en apply.
- [ ] `reconcileActaCalendar` sin `FATAL` (snapshots Calendario/Resultados).
- [ ] Sin flags `window.__ETR7_QA__` armadas.

Detalle de flujos: `docs/ACTAS_JSON_OPERATIONAL_CHECKLIST.md`.

---

## NO permitido para staging federativo

| Prohibido | Motivo |
|-----------|--------|
| `npm run dev` | `gasTransport` → mocks (`auth`, calendario, actaJson, calendarSync) |
| `npm run preview` sin MODE gas | Igual que dev |
| localhost | Sin `google.script.run` |
| Credencial `local-dev` | Auth mock |
| `VITE_ETR7_ACTA_PERSISTENCE=legacy` en build staging JSON | No ejercita save/close JSON |
| `window.__ETR7_QA__` | Simula fallos load/save/close |

En dev local con `hybrid` en `.env` local aparece banner rojo: **LOCAL DEV MOCK MODE**.

---

## Producción futura (referencia)

Cuando el piloto staging cierre:

- Build producción: omitir `VITE_ETR7_STAGING` o `false`.
- Activación gradual de `VITE_ETR7_ACTA_PERSISTENCE` según `docs/ACTAS_JSON_OPERATIONAL_CHECKLIST.md`.

---

## Referencias

| Tema | Archivo |
|------|---------|
| Entorno runtime | `frontend-react/src/app/runtimeEnvironment.ts` |
| Flags persistencia | `frontend-react/src/features/match-report/config/persistenceFlags.ts` |
| Auditoría readiness | conversación / informe staging readiness |
| Reconcile | `frontend-react/src/features/match-report/tools/reconcileActaCalendar.ts` |
