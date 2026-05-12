import type { ReactElement, ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '@/contexts/SessionContext'
import { BootstrapWait } from '@/router/guards/BootstrapWait'
import { AUTH_REDIRECTS } from '@/router/navigation.model'

interface GuestGuardProps {
  children: ReactNode
}

/**
 * Rutas solo para invitados (p. ej. login): si ya hay sesión, redirige al área autenticada.
 */
export function GuestGuard({ children }: GuestGuardProps): ReactElement {
  const { isSessionReady, state } = useSession()

  if (!isSessionReady) {
    return <BootstrapWait />
  }

  if (state.status === 'authenticated') {
    return <Navigate to={AUTH_REDIRECTS.postLogin} replace />
  }

  return <>{children}</>
}
