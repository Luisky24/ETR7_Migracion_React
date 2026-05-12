# ETR7 — Web App GAS (host React)

Proyecto **Apps Script independiente** que sirve la SPA compilada desde `../frontend-react` mediante HtmlService. No reutiliza `web.html`, router ni includes del legacy `ETRugby7`.

## Contenido

| Archivo            | Rol                                                |
| ------------------ | -------------------------------------------------- |
| `Code.gs`          | `doGet`, `include()` para inyectar CSS/JS        |
| `ReactHost.html`   | Plantilla mínima (`#root`, estilos y bundle)      |
| `Validacion.gs`    | `validarUsuario` (contrato array para el adapter) |
| `HojasEquipos.gs`  | Hoja de inscripciones vía Script Properties       |
| `Assets_*.html`    | **Generados** por el pipeline (ver abajo)         |

## Requisitos previos

- Node 18+ en la máquina de build.
- Proyecto Apps Script (nuevo) en script.google.com; opcionalmente [clasp](https://github.com/google/clasp) para subir archivos (plantilla: `.clasp.json.example` → `.clasp.json`).

## Pipeline build → GAS

Desde `frontend-react`:

```bash
npm run build:gas
```

Esto ejecuta `tsc`, `vite build --mode gas` y `scripts/sync-gas-webapp.mjs`, que escribe aquí `Assets_js.html` y `Assets_css.html` como HTML válido (`<script type="module">…</script>` y `<style>…</style>`) para `<?!= include(...) ?>` sin wrappers duplicados en `ReactHost.html`.

Después, copia o empuja **todos** los archivos de esta carpeta al proyecto Apps Script (incluidos los `Assets_*` generados).

## Despliegue Web App

1. En el editor Apps Script: **Implementar** → **Nueva implementación** → tipo **Aplicación web**.
2. Ejecutar como / acceso según política (por defecto `appsscript.json` usa `MYSELF` para pruebas).
3. Abrir la URL publicada: la SPA usa **HashRouter** (`#/`, `#/login`, `#/menu`) para evitar 404 al refrescar rutas en HtmlService.

## Login equipo (hoja)

Para claves de equipo (nivel 7), define en **Propiedades del proyecto → Propiedades del script**:

- `ETR7_INSCRIPCIONES_SPREADSHEET_ID` — ID del Google Sheet.
- `ETR7_INSCRIPCIONES_SHEET_NAME` — opcional; por defecto `Inscripciones Equipos`.

Sin ID, `Staf` / `LCV` / `Arbitro` siguen funcionando; el resto responde `KO`.

## Límites de tamaño

Apps Script impone un límite por archivo (~~50 KB en documentación histórica; el límite efectivo puede variar). Si el bundle supera el toque del proyecto, habrá que partir el JS o reducir el bundle antes de desplegar.
