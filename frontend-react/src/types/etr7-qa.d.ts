import type { Etr7QaRuntimeFlags } from '../features/match-report/utils/qaRuntimeSimulation'

declare global {
  interface Window {
    /** Simulación QA runtime (solo dev/mock; ignorado en `MODE === 'gas'`). */
    __ETR7_QA__?: Etr7QaRuntimeFlags
  }
}

export {}
