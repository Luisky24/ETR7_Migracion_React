import type { ReactNode } from 'react'
import { appConfig } from '@/app/appConfig'

interface RootLayoutProps {
  nav: ReactNode
  children: ReactNode
}

/**
 * Layout raíz: cabecera, navegación y contenido de página.
 */
export function RootLayout({ nav, children }: RootLayoutProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">{appConfig.appName} — Frontend React</h1>
        {nav}
      </header>
      <main>{children}</main>
    </div>
  )
}
