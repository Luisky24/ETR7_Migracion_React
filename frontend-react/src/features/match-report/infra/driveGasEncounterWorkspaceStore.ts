/**
 * Store Encounter Workspace vía boundaries GAS (`actaJson_*`) — contenido JSON del agregado.
 */

import type { ActaMatchKey } from '../contracts/actaDocument'
import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'
import type {
  EncounterWorkspaceProbeState,
  EncounterWorkspaceStore,
} from '../persistence/encounterWorkspace.repository'
import { ActaPersistenceError } from '../persistence/actaPersistenceError'
import { gasTransport } from '@/transport/gasTransport'
import { cloneWorkspace, normalizeStoredWorkspace } from './workspaceDriveFilePipeline'
import type {
  ActaJsonGasProbeResponse,
  ActaJsonGasReadPayload,
  ActaJsonGasReadResponse,
  ActaJsonGasWritePayload,
  ActaJsonGasWriteResponse,
} from './driveGasActaStore'

const GAS_READ = 'actaJson_readByMatchId'
const GAS_WRITE = 'actaJson_atomicWrite'
const GAS_PROBE = 'actaJson_probeDocument'

export class DriveGasEncounterWorkspaceStore implements EncounterWorkspaceStore {
  async probeDocumentState(key: ActaMatchKey): Promise<EncounterWorkspaceProbeState> {
    const res = await gasTransport.call<ActaJsonGasProbeResponse>(GAS_PROBE, toPayload(key))
    if (!res.ok || !res.state) {
      throw new ActaPersistenceError('IO_FAILURE', res.message ?? 'Error probe workspace JSON')
    }
    if (res.state === 'absent' || res.state === 'corrupt') return res.state
    const ws = await this.readCommitted(key)
    if (!ws) return 'absent'
    return 'valid'
  }

  async hasEntry(key: ActaMatchKey): Promise<boolean> {
    const state = await this.probeDocumentState(key)
    return state !== 'absent'
  }

  async readCommitted(key: ActaMatchKey): Promise<EncounterWorkspaceDocumentV1 | null> {
    const res = await gasTransport.call<ActaJsonGasReadResponse>(GAS_READ, toPayload(key))
    if (!res.ok) {
      if (res.code === 'CORRUPT_DOCUMENT') {
        throw new ActaPersistenceError('CORRUPT_DOCUMENT', res.message ?? 'Documento corrupto')
      }
      throw new ActaPersistenceError('IO_FAILURE', res.message ?? 'Error leyendo workspace JSON')
    }
    if (!res.document) return null
    const normalized = normalizeStoredWorkspace(res.document)
    if (!normalized) {
      throw new ActaPersistenceError('CORRUPT_DOCUMENT', 'JSON no es workspace ni acta legacy')
    }
    return cloneWorkspace(normalized)
  }

  async atomicReplace(key: ActaMatchKey, workspace: EncounterWorkspaceDocumentV1): Promise<void> {
    const payload: ActaJsonGasWritePayload = {
      ...toPayload(key),
      documentName: workspace.identity.documentFileName,
      content: JSON.stringify(workspace),
    }
    const res = await gasTransport.call<ActaJsonGasWriteResponse>(GAS_WRITE, payload)
    if (!res.ok) {
      throw new ActaPersistenceError(
        (res.code as ActaPersistenceError['code']) ?? 'IO_FAILURE',
        res.message ?? 'Error escribiendo workspace JSON',
      )
    }
  }
}

function toPayload(key: ActaMatchKey): ActaJsonGasReadPayload {
  return {
    category: key.category,
    phase: key.phase,
    matchId: key.matchId,
  }
}
