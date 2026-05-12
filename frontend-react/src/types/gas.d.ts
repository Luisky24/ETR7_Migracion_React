/**
 * Tipos mínimos para el host GAS (google.script.run).
 * Solo referenciados desde el transporte.
 *
 * Patrón: run.withSuccessHandler(...).withFailureHandler(...).nombreServidor(...args)
 */

export type GoogleScriptRunAfterFailure = Record<string, (...args: unknown[]) => void>

export interface GoogleScriptRunChain {
  withFailureHandler(callback: (error: unknown) => void): GoogleScriptRunAfterFailure
}

export interface GoogleScriptRun {
  withSuccessHandler(callback: (result: unknown) => void): GoogleScriptRunChain
}

declare global {
  interface Window {
    google?: {
      script?: {
        run?: GoogleScriptRun
      }
    }
  }
}

export {}
