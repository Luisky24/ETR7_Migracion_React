import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { isLocalSpaDevMode } from '@/app/localDevMode'
import { assertRuntimeEnvironment, logRuntimeStartup } from '@/app/runtimeEnvironment'
import { log } from '@/core/debug'
import { setMatchReportServiceMode } from '@/features/match-report'
import { logLocalDevTransportEnabled } from '@/transport/localDev/mockGasHandlers'
import '@/styles/global.css'

const isGasBuild = import.meta.env.MODE === 'gas'

/** Vite dev / preview: mock (sin `google.script.run`). Build `--mode gas`: GAS real. */
setMatchReportServiceMode(isGasBuild ? 'gas' : 'mock')

logRuntimeStartup()
assertRuntimeEnvironment()

if (isLocalSpaDevMode()) {
  logLocalDevTransportEnabled()
  log.debug('localDev.bootstrap', {
    matchReportMode: 'mock',
    gasTransport: 'mock',
    loginHint: 'local-dev',
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
