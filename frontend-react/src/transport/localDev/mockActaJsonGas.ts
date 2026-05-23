/**
 * Simulación local de boundaries `actaJson_*` — contenido Encounter Workspace.
 */

import type {
  ActaJsonGasLifecycleResponse,
  ActaJsonGasReadPayload,
  ActaJsonGasReadResponse,
  ActaJsonGasWritePayload,
  ActaJsonGasWriteResponse,
} from '@/features/match-report/infra/driveGasActaStore'
import { actaDocumentV1FromWorkspace } from '@/features/match-report/adapters/workspaceActa.mapper'
import { FakeDriveEncounterWorkspaceStore } from '@/features/match-report/infra/fakeDriveEncounterWorkspaceStore'
import { normalizeStoredWorkspace } from '@/features/match-report/infra/workspaceDriveFilePipeline'

const storeByPhase = new Map<string, FakeDriveEncounterWorkspaceStore>()

function phaseStoreKey(payload: ActaJsonGasReadPayload): string {
  return `${payload.category}::${payload.phase}`
}

function getStore(payload: ActaJsonGasReadPayload): FakeDriveEncounterWorkspaceStore {
  const k = phaseStoreKey(payload)
  let s = storeByPhase.get(k)
  if (!s) {
    s = new FakeDriveEncounterWorkspaceStore()
    storeByPhase.set(k, s)
  }
  return s
}

export async function mockActaJsonProbeDocument(
  payload: ActaJsonGasReadPayload,
): Promise<{ ok: boolean; state?: 'absent' | 'valid' | 'corrupt'; message?: string }> {
  const store = getStore(payload)
  const key = { category: payload.category, phase: payload.phase, matchId: payload.matchId }
  return { ok: true, state: await store.probeDocumentState(key) }
}

export async function mockActaJsonResolveLifecycle(
  payload: ActaJsonGasReadPayload,
): Promise<ActaJsonGasLifecycleResponse> {
  const store = getStore(payload)
  const key = { category: payload.category, phase: payload.phase, matchId: payload.matchId }
  const has = await store.hasEntry(key)
  if (!has) return { ok: true, lifecycle: 'NO_EXISTE' }
  const ws = await store.readCommitted(key)
  if (!ws?.acta) return { ok: true, lifecycle: 'NO_EXISTE' }
  return {
    ok: true,
    lifecycle: ws.acta.status === 'ACTA_CERRADA' ? 'ACTA_CERRADA' : 'ACTA_EN_CURSO',
  }
}

export async function mockActaJsonReadByMatchId(
  payload: ActaJsonGasReadPayload,
): Promise<ActaJsonGasReadResponse> {
  try {
    const store = getStore(payload)
    const key = { category: payload.category, phase: payload.phase, matchId: payload.matchId }
    const ws = await store.readCommitted(key)
    const acta = ws ? actaDocumentV1FromWorkspace(ws) : null
    return { ok: true, document: acta }
  } catch (e) {
    return {
      ok: false,
      code: e instanceof Error && 'code' in e ? String((e as { code: string }).code) : 'IO_FAILURE',
      message: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function mockActaJsonAtomicWrite(
  payload: ActaJsonGasWritePayload,
): Promise<ActaJsonGasWriteResponse> {
  try {
    const store = getStore(payload)
    const parsed = JSON.parse(payload.content) as unknown
    const workspace = normalizeStoredWorkspace(parsed)
    if (!workspace) {
      return { ok: false, code: 'VALIDATION_FAILED', message: 'Contenido no es workspace válido' }
    }
    const key = {
      category: payload.category,
      phase: payload.phase,
      matchId: payload.matchId,
    }
    await store.atomicReplace(key, workspace)
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      code: e instanceof Error && 'code' in e ? String((e as { code: string }).code) : 'IO_FAILURE',
      message: e instanceof Error ? e.message : String(e),
    }
  }
}

/** Limpia stores simulados (tests). */
export function resetMockActaJsonGasStores(): void {
  storeByPhase.clear()
}
