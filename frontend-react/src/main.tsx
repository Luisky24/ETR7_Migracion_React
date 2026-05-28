import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { isLocalSpaDevMode } from '@/app/localDevMode'
import { getRuntimeProfile } from '@/app/runtimeProfile'
import { assertRuntimeEnvironment, logRuntimeStartup } from '@/app/runtimeEnvironment'
import { log } from '@/core/debug'
import { setMatchReportServiceMode } from '@/features/match-report'
import { logLocalDevTransportEnabled } from '@/transport/localDev/mockGasHandlers'
import '@/styles/global.css'

const profile = getRuntimeProfile()

/** localDev → mock servicios; staging-gas / production → GAS real. */
setMatchReportServiceMode(profile === 'localDev' ? 'mock' : 'gas')

logRuntimeStartup()
assertRuntimeEnvironment()

if (isLocalSpaDevMode()) {
  logLocalDevTransportEnabled()
  log.debug('localDev.bootstrap', {
    profile: 'localDev',
    matchReportMode: 'mock',
    gasTransport: 'mock',
    documentStore: 'fakeDrive',
    loginHint: 'local-dev',
  })
} else {
  log.debug('gas.bootstrap', {
    profile,
    matchReportMode: 'gas',
    gasTransport: 'real',
    documentStore: 'gasDrive',
  })
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('No se encontró #root')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
