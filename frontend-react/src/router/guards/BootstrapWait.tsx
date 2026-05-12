import type { ReactElement } from 'react'

/** UI mínima mientras SessionContext termina la rehidratación desde sessionStorage. */
export function BootstrapWait(): ReactElement {
  return (
    <output className="mx-auto flex max-w-sm flex-col items-center gap-2 rounded border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
      <span className="h-5 w-5 animate-pulse rounded-full bg-slate-400" aria-hidden />
      <span>Preparando sesión…</span>
    </output>
  )
}
