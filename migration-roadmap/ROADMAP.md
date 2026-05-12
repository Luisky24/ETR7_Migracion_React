# Roadmap de migración (ETR7 → React)

## Fase 0 — Auditoría legacy

- Inventario de módulos/pantallas del legacy.
- Identificación de dependencias y flujos críticos.
- Definición de límites de módulos y prioridades.

## Fase 1 — Base React

- Estructura inicial del proyecto React (sin dependencias pesadas ni app generada).
- Documentación de arquitectura y estrategia.

## Fase 2 — Login React

- Implementación del login en React.
- Integración con backend GAS temporal.
- Definición del contrato mínimo de autenticación (request/response).

## Fase 3 — Menú React

- Implementación del menú principal en React.
- Navegación inicial y estructura de pantallas.
- Integración con GAS para permisos/datos necesarios.

## Fase 4 — Contratos frontend/backend

- Estabilización de contratos en `shared-contracts`.
- Consolidación de modelos y convenciones de API.

## Fase 5 — Migración incremental de módulos

- Migración por módulos priorizados.
- Entregas pequeñas y reversibles.
- Reducción progresiva de dependencias del frontend sobre el legacy.

