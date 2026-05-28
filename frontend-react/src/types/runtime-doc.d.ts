import type { RuntimeDocDiagnosticsApi } from '@/features/match-report/tools/runtimeDocDiagnostics'
import type { RuntimeReconcileResult } from '@/features/match-report/tools/runtimeReconcileDiagnostics.contract'

declare global {
  interface Window {
    /** Diagnóstico documental runtime (solo DEV/staging-gas). */
    __ETR7_DOC__?: RuntimeDocDiagnosticsApi
  }
}

export type { RuntimeReconcileResult }

export {}

