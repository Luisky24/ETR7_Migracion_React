/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `hash` para Web App GAS (rutas tras `#`). Omitir o `browser` para desarrollo local con BrowserRouter. */
  readonly VITE_ROUTER_MODE?: 'hash' | 'browser'
  /**
   * Logs estructurados (`src/core/debug/logger.ts`).
   * `true` | `1`: forzar ON. `false` | `0`: forzar OFF.
   * Sin valor: en desarrollo ON; en producción OFF salvo que se fuerce.
   */
  readonly VITE_ETR7_DEBUG?: string
  /** Persistencia acta: `legacy` | `json` | `hybrid` (default `legacy`). */
  readonly VITE_ETR7_ACTA_PERSISTENCE?: string
  /** `true` en build staging (.env.gas): muestra banner NO PRODUCCIÓN. */
  readonly VITE_ETR7_STAGING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
