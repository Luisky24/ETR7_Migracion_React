/**
 * Feature flag de persistencia de actas (build-time Vite).
 * La carga runtime siempre usa Encounter Workspace (Fase 3).
 * `legacy` — solo afecta save/close hacia Sheets cuando aplique.
 * `json` | `hybrid` — save/close documental workspace.
 *
 * Staging federativo: `VITE_ETR7_ACTA_PERSISTENCE=hybrid` en `.env.gas` + `npm run build:gas`.
 */

export type ActaPersistenceMode = 'legacy' | 'json' | 'hybrid'

const DEFAULT_MODE: ActaPersistenceMode = 'legacy'

export function parseActaPersistenceMode(raw: string | undefined): ActaPersistenceMode {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'json' || v === 'hybrid' || v === 'legacy') {
    return v
  }
  return DEFAULT_MODE
}

/** Modo activo en runtime (lectura de `import.meta.env`). */
export function getActaPersistenceMode(): ActaPersistenceMode {
  return parseActaPersistenceMode(import.meta.env.VITE_ETR7_ACTA_PERSISTENCE)
}

/** Save/close documental workspace (`json` y `hybrid`). */
export function usesJsonPersistence(mode: ActaPersistenceMode = getActaPersistenceMode()): boolean {
  return mode === 'json' || mode === 'hybrid'
}

/** @deprecated Usar usesJsonPersistence — la carga ya no depende de este flag. */
export const usesJsonBootstrap = usesJsonPersistence
