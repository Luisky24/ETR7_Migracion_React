/**
 * Simulación local de boundaries `alignmentJson_*` — contenido AlignmentDocumentV1 + índice.
 */

import type { AlignmentDocumentV1 } from '@/shared/contracts/alignment.document'
import {
  FakeDriveAlignmentDocumentStore,
  type AlignmentDocumentKey,
} from '@/features/alineaciones-v2/persistence/alignmentDocument.repository'

type ProbeState = 'absent' | 'valid' | 'corrupt'

type AlignmentJsonKeyPayload = {
  readonly storageKey: string
  readonly categoryId: string
  readonly seasonId: string
  readonly teamId: string
  readonly matchId: string
  readonly phaseId: string
  readonly encounterId: string
  readonly teamCode?: string
  readonly phaseCode?: string
  readonly encounterCode?: string
  readonly roleInMatch?: 'LOCAL' | 'VISITANTE'
}

type AlignmentJsonWritePayload = AlignmentJsonKeyPayload & {
  readonly documentName: string
  readonly content: string
}

const storeByPhase = new Map<string, FakeDriveAlignmentDocumentStore>()

function phaseKey(payload: { categoryId: string; phaseId: string }): string {
  return `${payload.categoryId}::${payload.phaseId}`
}

function getStore(payload: { categoryId: string; phaseId: string }): FakeDriveAlignmentDocumentStore {
  const k = phaseKey(payload)
  let s = storeByPhase.get(k)
  if (!s) {
    s = new FakeDriveAlignmentDocumentStore()
    storeByPhase.set(k, s)
  }
  return s
}

function toKey(payload: AlignmentJsonKeyPayload): AlignmentDocumentKey {
  return {
    storageKey: payload.storageKey,
    matchId: payload.matchId,
    categoryId: payload.categoryId,
    seasonId: payload.seasonId,
    teamId: payload.teamId,
    teamCode: payload.teamCode ?? payload.teamId,
    roleInMatch: payload.roleInMatch ?? 'LOCAL',
    phaseId: payload.phaseId,
    phaseCode: payload.phaseCode ?? payload.phaseId,
    encounterId: payload.encounterId,
    encounterCode: payload.encounterCode ?? payload.encounterId,
  }
}

export async function mockAlignmentJsonProbeDocument(
  payload: AlignmentJsonKeyPayload,
): Promise<{ ok: boolean; state?: ProbeState; message?: string }> {
  const store = getStore(payload)
  const state = await store.probeDocumentState(toKey(payload))
  return { ok: true, state }
}

export async function mockAlignmentJsonReadByStorageKey(
  payload: AlignmentJsonKeyPayload,
): Promise<{ ok: boolean; document?: unknown | null; message?: string; code?: string }> {
  try {
    const store = getStore(payload)
    const doc = await store.readCommitted(toKey(payload))
    return { ok: true, document: doc ?? null }
  } catch (e) {
    return { ok: false, code: 'IO_FAILURE', message: e instanceof Error ? e.message : String(e) }
  }
}

export async function mockAlignmentJsonAtomicWrite(
  payload: AlignmentJsonWritePayload,
): Promise<{ ok: boolean; message?: string; code?: string }> {
  try {
    const store = getStore(payload)
    const doc = JSON.parse(payload.content) as AlignmentDocumentV1
    store.injectRawDocument(payload.documentName, doc)
    return { ok: true }
  } catch (e) {
    return { ok: false, code: 'IO_FAILURE', message: e instanceof Error ? e.message : String(e) }
  }
}

export async function mockAlignmentJsonReadIndexByContext(payload: {
  categoryId: string
  phaseId: string
}): Promise<{ ok: boolean; document?: unknown | null; message?: string; code?: string }> {
  const store = getStore(payload)
  return { ok: true, document: await store.readIndexRaw() }
}

export async function mockAlignmentJsonAtomicWriteIndex(payload: {
  categoryId: string
  phaseId: string
  content: string
}): Promise<{ ok: boolean; message?: string; code?: string }> {
  try {
    const store = getStore(payload)
    await store.atomicReplaceIndexRaw(payload.content)
    return { ok: true }
  } catch (e) {
    return { ok: false, code: 'IO_FAILURE', message: e instanceof Error ? e.message : String(e) }
  }
}

export async function mockAlignmentJsonRebuildIndex(payload: {
  categoryId: string
  phaseId: string
}): Promise<{ ok: boolean; document?: unknown; message?: string; code?: string }> {
  try {
    const store = getStore(payload)
    // naive: nothing to do; store rebuild is implemented in repository, not store.
    return { ok: true, document: await store.readIndexRaw() }
  } catch (e) {
    return { ok: false, code: 'IO_FAILURE', message: e instanceof Error ? e.message : String(e) }
  }
}

export async function mockAlignmentJsonBootstrapPlayersFromSheets(payload: {
  categoryId: string
  teamCode: string
}): Promise<{ ok: boolean; players?: unknown[]; message?: string; code?: string }> {
  // local-dev: devuelve lista determinista sin leer Sheets
  return {
    ok: true,
    players: [
      { playerId: `sheet:${payload.teamCode}:1`, displayName: 'Jugador 1', dorsal: 0 },
      { playerId: `sheet:${payload.teamCode}:2`, displayName: 'Jugador 2', dorsal: 0 },
    ],
  }
}

export function resetMockAlignmentJsonGasStores(): void {
  storeByPhase.clear()
}

