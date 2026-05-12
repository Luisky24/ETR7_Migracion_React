import { NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { hasCapability } from '@/contracts/capabilities.contract'
import { useSession } from '@/contexts/SessionContext'
import { RootLayout } from '@/layouts/RootLayout'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { CalendarMatchesPage } from '@/features/calendar/pages/CalendarMatchesPage'
import { MenuPage } from '@/pages/MenuPage'
import { AuthGuard, GuestGuard } from '@/router/guards'
import { ROUTES } from '@/router/routes'

function AppNav() {
  const { isSessionReady, lifecycle, state } = useSession()
  const canCalendar =
    state.status === 'authenticated' && hasCapability(state.user.capabilities, 'canAccessCalendar')

  return (
    <nav className="app-nav" aria-label="Principal">
      <NavLink to={ROUTES.home} end>
        Inicio
      </NavLink>
      {isSessionReady && lifecycle === 'guest' ? (
        <NavLink to={ROUTES.login}>Acceso</NavLink>
      ) : null}
      {isSessionReady && lifecycle === 'authenticated' ? (
        <>
          <NavLink to={ROUTES.menu}>Menú</NavLink>
          {canCalendar ? <NavLink to={ROUTES.calendar}>Calendario</NavLink> : null}
        </>
      ) : null}
    </nav>
  )
}

function ShellLayout() {
  return (
    <RootLayout nav={<AppNav />}>
      <Outlet />
    </RootLayout>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<ShellLayout />}>
        <Route index element={<HomePage />} />
        <Route
          path="login"
          element={
            <GuestGuard>
              <LoginPage />
            </GuestGuard>
          }
        />
        <Route
          path="menu"
          element={
            <AuthGuard>
              <MenuPage />
            </AuthGuard>
          }
        />
        <Route
          path="calendar"
          element={
            <AuthGuard>
              <CalendarMatchesPage />
            </AuthGuard>
          }
        />
      </Route>
    </Routes>
  )
}
