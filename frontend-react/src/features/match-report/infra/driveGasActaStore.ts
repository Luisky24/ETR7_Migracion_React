/**
 * Store Drive vía boundaries GAS (`actaJson_*`).
 */

import type { ActaDocumentV1, ActaMatchKey } from '../contracts/actaDocument'
import type { ActaDocumentStore } from '../persistence/actaRepositoryCore'
import { ActaPersistenceError, cloneDocument } from '../persistence/actaPersistenceError'
import { gasTransport } from '@/transport/gasTransport'

export interface ActaJsonGasReadPayload {
  readonly category: ActaMatchKey['category']
  readonly phase: ActaMatchKey['phase']
  readonly matchId: string
}

export interface ActaJsonGasReadResponse {
  readonly ok: boolean
  readonly document?: ActaDocumentV1 | null
  readonly code?: string
  readonly message?: string
}

export interface ActaJsonGasWritePayload {
  readonly category: ActaMatchKey['category']
  readonly phase: ActaMatchKey['phase']
  readonly matchId: string
  readonly documentName: string
  readonly content: string
}

export interface ActaJsonGasWriteResponse {
  readonly ok: boolean
  readonly code?: string
  readonly message?: string
}

export interface ActaJsonGasLifecycleResponse {
  readonly ok: boolean
  readonly lifecycle?: 'NO_EXISTE' | 'ACTA_EN_CURSO' | 'ACTA_CERRADA'
  readonly code?: string
  readonly message?: string
}

const GAS_READ = 'actaJson_readByMatchId'
const GAS_WRITE = 'actaJson_atomicWrite'
const GAS_PROBE = 'actaJson_probeDocument'

export type ActaDocumentProbeState = 'absent' | 'valid' | 'corrupt'

export interface ActaJsonGasProbeResponse {
  readonly ok: boolean
  readonly state?: ActaDocumentProbeState
  readonly code?: string
  readonly message?: string
}

export class DriveGasActaDocumentStore implements ActaDocumentStore {
  async probeDocumentState(key: ActaMatchKey): Promise<ActaDocumentProbeState> {
    const res = await gasTransport.call<ActaJsonGasProbeResponse>(GAS_PROBE, toPayload(key))
    if (!res.ok || !res.state) {
      throw new ActaPersistenceError('IO_FAILURE', res.message ?? 'Error probe acta JSON')
    }
    return res.state
  }

  async hasEntry(key: ActaMatchKey): Promise<boolean> {
    const state = await this.probeDocumentState(key)
    return state !== 'absent'
  }

  async readCommitted(key: ActaMatchKey): Promise<ActaDocumentV1 | null> {
    const res = await gasTransport.call<ActaJsonGasReadResponse>(GAS_READ, toPayload(key))
    if (!res.ok) {
      if (res.code === 'CORRUPT_DOCUMENT') {
        throw new ActaPersistenceError('CORRUPT_DOCUMENT', res.message ?? 'Documento corrupto')
      }
      throw new ActaPersistenceError('IO_FAILURE', res.message ?? 'Error leyendo acta JSON')
    }
    return res.document ? cloneDocument(res.document) : null
  }

  async atomicReplace(key: ActaMatchKey, document: ActaDocumentV1): Promise<void> {
    const payload: ActaJsonGasWritePayload = {
      ...toPayload(key),
      documentName: document.match.documentName,
      content: JSON.stringify(document),
    }
    const res = await gasTransport.call<ActaJsonGasWriteResponse>(GAS_WRITE, payload)
    if (!res.ok) {
      throw new ActaPersistenceError(
        (res.code as ActaPersistenceError['code']) ?? 'IO_FAILURE',
        res.message ?? 'Error escribiendo acta JSON',
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
