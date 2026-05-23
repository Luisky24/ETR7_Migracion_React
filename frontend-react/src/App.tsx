import { BrowserRouter, HashRouter } from 'react-router-dom'
import { appConfig } from '@/app/appConfig'
import { LocalDevJsonWarningBanner } from '@/components/LocalDevJsonWarningBanner'
import { StagingEnvironmentBanner } from '@/components/StagingEnvironmentBanner'
import { SessionProvider } from '@/contexts/SessionContext'
import { AppRouter } from '@/router/AppRouter'

function EnvironmentBanners() {
  return (
    <>
      <LocalDevJsonWarningBanner />
      <StagingEnvironmentBanner />
    </>
  )
}

function RoutedApp() {
  return (
    <SessionProvider>
      <EnvironmentBanners />
      <AppRouter />
    </SessionProvider>
  )
}

export function App() {
  const useHashRouter = import.meta.env.VITE_ROUTER_MODE === 'hash'

  if (useHashRouter) {
    return (
      <HashRouter>
        <RoutedApp />
      </HashRouter>
    )
  }

  return (
    <BrowserRouter basename={appConfig.basePath}>
      <RoutedApp />
    </BrowserRouter>
  )
}
