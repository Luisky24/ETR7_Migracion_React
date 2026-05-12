import type { ReactElement, ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '@/contexts/SessionContext'
import { BootstrapWait } from '@/router/guards/BootstrapWait'
import { AUTH_REDIRECTS } from '@/router/navigation.model'

interface AuthGuardProps {
  children: ReactNode
}

/**
 * Protege rutas que requieren sesión autenticada. No conoce transport ni GAS.
 */
export function AuthGuard({ children }: AuthGuardProps): ReactElement {
  const { isSessionReady, state } = useSession()
  const location = useLocation()

  if (!isSessionReady) {
    return <BootstrapWait />
  }

  if (state.status !== 'authenticated') {
    return <Navigate to={AUTH_REDIRECTS.requireAuth} replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
