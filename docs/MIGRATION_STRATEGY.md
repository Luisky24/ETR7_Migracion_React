# Estrategia de migración (incremental)

## Enfoque general

Migración progresiva de ETR7 hacia **React** manteniendo **GAS** como backend temporal, con el proyecto legacy `ETRugby7` funcionando como sistema principal y **sin modificaciones**.

## Fases iniciales (alto nivel)

### Fase 0 — Preparación y auditoría (legacy)

- Inventario funcional y técnico del legacy.
- Identificación de módulos, pantallas, flujos y dependencias.
- Definición de los primeros puntos de integración (APIs temporales en GAS).

### Fase 1 — Base React (estructura y estándares mínimos)

- Estructura de proyecto React (sin instalar ni generar app completa todavía).
- Convenciones de carpetas, documentación y criterios de calidad.

### Fase 2 — Login en React (primer módulo)

- Implementar el flujo de **login** en React.
- Integración con el backend temporal (GAS) para autenticación/validación.
- Definir el contrato mínimo necesario para el login (request/response).

### Fase 3 — Menú principal en React (segundo módulo)

- Implementar el **menú principal** y navegación inicial en React.
- Integración con endpoints temporales necesarios (GAS).

## GAS como backend temporal

- GAS se mantiene como backend mientras se migran módulos.
- Los endpoints serán temporales y evolucionarán hacia contratos más estables en fases posteriores.

## Estabilización futura de contratos

- Consolidar **modelos y APIs** en `shared-contracts` para reducir ambigüedades.
- Objetivo: minimizar cambios de integración y desacoplar frontend/backend.

## Riesgos principales iniciales

- **Acoplamiento implícito al legacy**: reproducir reglas/formatos sin contrato explícito aumenta retrabajo.
- **Autenticación y permisos**: discrepancias entre UX React y validaciones reales en GAS pueden bloquear el login.
- **Evolución no controlada de endpoints**: cambios rápidos en GAS sin versionado/contrato rompen el frontend.
- **Doble fuente de verdad** (legacy vs React): si conviven pantallas equivalentes sin criterios claros, aumenta la confusión operativa.
- **Alcance incremental insuficiente**: si las fases iniciales no entregan valor visible (login/menú), se pierde tracción.

