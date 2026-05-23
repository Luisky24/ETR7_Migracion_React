/**
 * @deprecated Fase 3 — usar encounterWorkspaceLoad.adapter.
 * Re-export de compatibilidad para tests e imports legacy.
 */

export {
  createEncounterWorkspaceLoadAdapter,
  createEncounterWorkspaceLoadAdapter as createActaBootstrapAdapter,
  matchKeyFromContext,
  type EncounterWorkspaceLoadAdapterOptions,
  type EncounterWorkspaceLoadAdapterOptions as ActaBootstrapAdapterOptions,
  type EncounterWorkspaceLoadLogger,
  type EncounterWorkspaceLoadLogger as ActaBootstrapLogger,
} from './encounterWorkspaceLoad.adapter'
