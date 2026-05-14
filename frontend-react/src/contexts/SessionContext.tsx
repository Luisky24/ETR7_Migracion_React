import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { log } from '@/core/debug'
import { authService } from '@/services/authService'
import {
  defaultSessionState,
  type SessionAuthenticatedState,
  type SessionLifecycle,
  type SessionState,
  type SessionUser,
} from '@/contracts/session.contract'
import {
  clearPersistedSessionFromStorage,
  PERSISTED_SESSION_VERSION,
  readPersistedSessionFromStorage,
  writePersistedSessionToStorage,
} from '@/session/persistedSession'
import { getSessionStorageSafe } from '@/session/sessionStorageBridge'
import { AUTH_REDIRECTS } from '@/router/navigation.model'

export interface SessionContextValue {
  /** Fuente de verdad de sesión en React (lectura inicial síncrona desde sessionStorage). */
  state: SessionState
  lifecycle: SessionLifecycle
  isAuthLoading: boolean
  authError: string | null
  login: (credential: string) => Promise<void>
  logout: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

interface SessionProviderProps {
  children: ReactNode
}

function persistUser(user: SessionUser): void {
  const storage = getSessionStorageSafe()
  if (!storage) {
    return
  }
  writePersistedSessionToStorage(storage.setItem.bind(storage), {
    v: PERSISTED_SESSION_VERSION,
    user: {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      capabilities: user.capabilities,
      ...(user.team ? { team: user.team } : {}),
    },
  })
}

function clearPersistedUser(): void {
  const storage = getSessionStorageSafe()
  if (!storage) {
    return
  }
  clearPersistedSessionFromStorage(storage.removeItem.bind(storage))
}

function buildAuthenticatedSession(data: {
  id: string
  displayName: string
  role: SessionUser['role']
  capabilities: SessionUser['capabilities']
  team?: SessionUser['team']
}): SessionAuthenticatedState {
  const user: SessionUser = {
    id: data.id,
    displayName: data.displayName,
    role: data.role,
    capabilities: data.capabilities,
    ...(data.team ? { team: data.team } : {}),
  }
  return { status: 'authenticated', user }
}

function readInitialSessionFromBrowserStorage(): SessionState {
  const storage = getSessionStorageSafe()
  if (!storage) {
    return defaultSessionState
  }
  const snapshot = readPersistedSessionFromStorage(storage.getItem.bind(storage))
  if (!snapshot) {
    return defaultSessionState
  }
  const u = snapshot.user
  return buildAuthenticatedSession({
    id: u.id,
    displayName: u.displayName,
    role: u.role,
    capabilities: u.capabilities,
    ...(u.team ? { team: u.team } : {}),
  })
}

export function SessionProvider({ children }: SessionProviderProps) {
  const navigate = useNavigate()
  const [state, setState] = useState<SessionState>(readInitialSessionFromBrowserStorage)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    log.debug('session.bootstrap', {
      authenticated: state.status === 'authenticated',
    })
    // Solo traza de arranque; no reaccionar a cambios posteriores de sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(
    async (credential: string) => {
      setIsAuthLoading(true)
      setAuthError(null)
      log.debug('session.login.submit', {})
      try {
        const result = await authService.login({ credential })
        if (result.ok) {
          log.debug('session.login.success', { role: result.data.role })
          const next = buildAuthenticatedSession({
            id: result.data.userId,
            displayName: result.data.displayName,
            role: result.data.role,
            capabilities: result.data.capabilities,
            team: result.data.team,
          })
          persistUser(next.user)
          setState(next)
          void navigate(AUTH_REDIRECTS.postLogin, { replace: true })
        } else {
          log.warn('session.login.denied', { code: result.error.code })
          setAuthError(result.error.message)
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        log.error('session.login.exception', { message })
        setAuthError('No se pudo conectar con el servidor. Reintenta en unos segundos.')
      } finally {
        setIsAuthLoading(false)
      }
    },
    [navigate],
  )

  const logout = useCallback(() => {
    log.debug('session.logout', {})
    authService.logout()
    clearPersistedUser()
    setState(defaultSessionState)
    void navigate(AUTH_REDIRECTS.requireAuth, { replace: true })
  }, [navigate])

  const lifecycle: SessionLifecycle = useMemo(() => {
    return state.status === 'authenticated' ? 'authenticated' : 'guest'
  }, [state.status])

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      lifecycle,
      isAuthLoading,
      authError,
      login,
      logout,
    }),
    [state, lifecycle, isAuthLoading, authError, login, logout],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession debe usarse dentro de SessionProvider')
  }
  return ctx
}
