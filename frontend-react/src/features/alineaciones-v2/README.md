# `features/alineaciones-v2` — contexto editable por equipo

Workflow operativo: cargar contexto, editar draft, guardar y confirmar.

| Ruta SPA | Página |
|----------|--------|
| `/calendar/team-lineup-context` | `TeamLineupContextPage` |

**Boundaries GAS:** `alineaciones_getTeamLineupContext_v2`, `_saveTeamLineup_v2`, `_confirmTeamLineup_v2`

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `pages/` | Orquestación SAVE/CONFIRM, modales, reconcile |
| `components/` | UI (header, panel, modales, listado jugadores) |
| `hooks/` | GET contexto, dirty guard, countdown |
| `contracts/` | Tipos wire ↔ TypeScript |
| `services/` | `gasTransport` → boundaries |
| `adapters/` | Normalización respuesta GAS |
| `domain/` | Barrel dominio (`lineup*` utils) |
| `types/` | `TeamLineupDraftState` |
| `utils/` | Implementación dominio + query URL |

## Nomenclatura (resumen)

| Término | Significado |
|---------|-------------|
| **draft** | Estado editable en memoria |
| **persistedSnapshot** | Clon tras GET/SAVE/CONFIRM; baseline dirty-state |
| **workflow** | DTO GAS: slot calendario, acta, hoja ENC |
| **runtime** | `LineupRuntimeState` derivado en cliente (badge, lock, acciones) |
| **phase** | `LineupOperationalPhase` — prioridad de badge |
| **reconcile** | `reconcileLineupDraftFromWire` — alinear draft con servidor |

Lectura dual del mismo dominio: [`../alineaciones`](../alineaciones/README.md).

Documentación: [`docs/ALINEACIONES_REACT_RUNTIME.md`](../../../../docs/ALINEACIONES_REACT_RUNTIME.md) · deuda: [`docs/ALINEACIONES_TECHNICAL_DEBT.md`](../../../../docs/ALINEACIONES_TECHNICAL_DEBT.md)
