# ETR7 — Migración progresiva a React (frontend)

## Objetivo

Crear un **entorno limpio y desacoplado** para migrar ETR7 hacia un **frontend React moderno**, manteniendo **Google Apps Script (GAS)** como backend **temporal** durante las primeras fases.

## Relación con el legacy

- El proyecto legacy vive en: `../ETRugby7`
- **Regla de oro**: `ETRugby7` se mantiene **intacto** (sin mover/copiar/refactorizar ni añadir tooling React).
- La migración se desarrolla **en paralelo** dentro de este directorio: `ETR7_Migracion_React`.

## Estructura

```txt
ETR7_Migracion_React/
  frontend-react/
    src/
    public/
  docs/
  scripts/
  shared-contracts/
  analysis/
  migration-roadmap/
```

## Estrategia (resumen)

- **Incremental**: migración por módulos.
- **Coexistencia controlada**: React convive con legacy y consume GAS como backend temporal.
- **Contratos**: se preparan espacios para estabilizar APIs/modelos entre frontend y backend.

Documentos clave:

- `docs/ARCHITECTURE.md`
- `docs/MIGRATION_STRATEGY.md`
- `migration-roadmap/ROADMAP.md`

## Principios

- Desacoplamiento frontend/backend
- No contaminación del legacy
- Entregas pequeñas, medibles y reversibles

## Estado actual

Fase de **preparación estructural**:

- Solo estructura de carpetas y documentación base
- Sin instalación de dependencias
- Sin generación de aplicación React (Vite/CRA/etc.)

