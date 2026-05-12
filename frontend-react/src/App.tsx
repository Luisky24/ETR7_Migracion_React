import { BrowserRouter, HashRouter } from 'react-router-dom'
import { appConfig } from '@/app/appConfig'
import { SessionProvider } from '@/contexts/SessionContext'
import { AppRouter } from '@/router/AppRouter'

function RoutedApp() {
  return (
    <SessionProvider>
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
