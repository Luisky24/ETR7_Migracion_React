import { log } from '@/core/debug'
import {
  mockActaJsonAtomicWrite,
  mockActaJsonProbeDocument,
  mockActaJsonReadByMatchId,
  mockActaJsonResolveLifecycle,
} from './mockActaJsonGas'
import { LOCAL_DEV_CREDENTIAL_HINT, mockAuthLoginV2Response } from './mockAuthLogin'
import { mockCalendarGetMatchesV2Response } from './mockCalendarMatches'
import { mockCalendarSyncApplyBundle } from './mockCalendarSyncGas'

const MOCK_DELAY_MS = 40

function delay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, MOCK_DELAY_MS)
  })
}

/**
 * Despacha llamadas GAS simuladas en desarrollo local (sin `google.script.run`).
 */
export async function dispatchLocalDevMockGasCall(
  functionName: string,
  args: readonly unknown[],
): Promise<unknown> {
  await delay()

  switch (functionName) {
    case 'auth_login_v2':
      return mockAuthLoginV2Response(args[0])
    case 'calendar_getMatches_v2':
      return mockCalendarGetMatchesV2Response(args[0], args[1])
    case 'actaJson_probeDocument':
      return mockActaJsonProbeDocument(args[0] as Parameters<typeof mockActaJsonProbeDocument>[0])
    case 'actaJson_resolveLifecycle':
      return mockActaJsonResolveLifecycle(args[0] as Parameters<typeof mockActaJsonResolveLifecycle>[0])
    case 'actaJson_readByMatchId':
      return mockActaJsonReadByMatchId(args[0] as Parameters<typeof mockActaJsonReadByMatchId>[0])
    case 'actaJson_atomicWrite':
      return mockActaJsonAtomicWrite(args[0] as Parameters<typeof mockActaJsonAtomicWrite>[0])
    case 'calendarSync_applyBundle':
      return mockCalendarSyncApplyBundle(args[0])
    default:
      log.warn('localDev.mock.unhandled', { functionName, hint: 'Añadir handler en mockGasHandlers.ts' })
      throw new Error(
        `[ETR7 local-dev] Función GAS no simulada: "${functionName}". Usa módulos con modo mock o despliega con MODE=gas.`,
      )
  }
}

export function logLocalDevTransportEnabled(): void {
  log.debug('localDev.transport.enabled', {
    mode: import.meta.env.MODE,
    credentialHint: LOCAL_DEV_CREDENTIAL_HINT,
  })
}
