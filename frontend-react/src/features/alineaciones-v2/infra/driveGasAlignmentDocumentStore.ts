/**
 * Store AlignmentDocumentV1 vía boundaries GAS — persistencia JSON real.
 * Nota: los endpoints GAS se implementan server-side (Apps Script) en fase correspondiente.
 */

import type { AlignmentDocumentV1 } from '@/shared/contracts/alignment.document'
import { gasTransport } from '@/transport/gasTransport'
import type {
  AlignmentDocumentKey,
  AlignmentDocumentStore,
  AlignmentProbeState,
} from '../persistence/alignmentDocument.repository'
import { ActaPersistenceError } from '@/features/match-report/persistence/actaPersistenceError'

const GAS_READ = 'alignmentJson_readByStorageKey'
const GAS_WRITE = 'alignmentJson_atomicWrite'
const GAS_PROBE = 'alignmentJson_probeDocument'
const GAS_READ_INDEX = 'alignmentJson_readIndexByContext'
const GAS_WRITE_INDEX = 'alignmentJson_atomicWriteIndex'

type AlignmentJsonGasProbeResponse = { readonly ok: boolean; readonly state?: AlignmentProbeState; readonly message?: string; readonly code?: string }
type AlignmentJsonGasReadResponse = { readonly ok: boolean; readonly document?: unknown | null; readonly message?: string; readonly code?: string }
type AlignmentJsonGasWriteResponse = { readonly ok: boolean; readonly message?: string; readonly code?: string }

type AlignmentJsonGasKeyPayload = {
  readonly storageKey: string
  readonly categoryId: string
  readonly seasonId: string
  readonly teamId: string
  readonly matchId: string
  readonly phaseId: string
  readonly encounterId: string
}

type AlignmentJsonGasWritePayload = AlignmentJsonGasKeyPayload & {
  readonly documentName: string
  readonly content: string
}

export class DriveGasAlignmentDocumentStore implements AlignmentDocumentStore {
  constructor(
    private readonly indexContext: { readonly categoryId: string; readonly phaseId: string },
  ) {}

  async probeDocumentState(key: AlignmentDocumentKey): Promise<AlignmentProbeState> {
    const res = await gasTransport.call<AlignmentJsonGasProbeResponse>(GAS_PROBE, toPayload(key))
    if (!res.ok || !res.state) {
      throw new ActaPersistenceError('IO_FAILURE', res.message ?? 'Error probe alignment JSON')
    }
    return res.state
  }

  async hasEntry(key: AlignmentDocumentKey): Promise<boolean> {
    const state = await this.probeDocumentState(key)
    return state !== 'absent'
  }

  async readCommitted(key: AlignmentDocumentKey): Promise<AlignmentDocumentV1 | null> {
    const res = await gasTransport.call<AlignmentJsonGasReadResponse>(GAS_READ, toPayload(key))
    if (!res.ok) {
      if (res.code === 'CORRUPT_DOCUMENT') {
        throw new ActaPersistenceError('CORRUPT_DOCUMENT', res.message ?? 'Documento corrupto')
      }
      throw new ActaPersistenceError('IO_FAILURE', res.message ?? 'Error leyendo alignment JSON')
    }
    if (!res.document) return null
    return res.document as AlignmentDocumentV1
  }

  async atomicReplace(key: AlignmentDocumentKey, document: AlignmentDocumentV1): Promise<void> {
    const payload: AlignmentJsonGasWritePayload = {
      ...toPayload(key),
      documentName: document.identity.documentFileName.replace(/\.json$/, ''),
      content: JSON.stringify(document),
    }
    const res = await gasTransport.call<AlignmentJsonGasWriteResponse>(GAS_WRITE, payload)
    if (!res.ok) {
      throw new ActaPersistenceError(
        (res.code as ActaPersistenceError['code']) ?? 'IO_FAILURE',
        res.message ?? 'Error escribiendo alignment JSON',
      )
    }
  }

  async readIndexRaw(): Promise<unknown | null> {
    const res = await gasTransport.call<AlignmentJsonGasReadResponse>(GAS_READ_INDEX, {
      categoryId: this.indexContext.categoryId,
      phaseId: this.indexContext.phaseId,
    })
    if (!res.ok) {
      throw new ActaPersistenceError('IO_FAILURE', res.message ?? 'Error leyendo índice alignment')
    }
    return res.document ?? null
  }

  async atomicReplaceIndexRaw(rawIndexJson: string): Promise<void> {
    const res = await gasTransport.call<AlignmentJsonGasWriteResponse>(GAS_WRITE_INDEX, {
      categoryId: this.indexContext.categoryId,
      phaseId: this.indexContext.phaseId,
      content: rawIndexJson,
    })
    if (!res.ok) {
      throw new ActaPersistenceError(
        (res.code as ActaPersistenceError['code']) ?? 'IO_FAILURE',
        res.message ?? 'Error escribiendo índice alignment',
      )
    }
  }
}

function toPayload(key: AlignmentDocumentKey): AlignmentJsonGasKeyPayload {
  return {
    storageKey: key.storageKey,
    categoryId: key.categoryId,
    seasonId: key.seasonId,
    teamId: key.teamId,
    matchId: key.matchId,
    phaseId: key.phaseId,
    encounterId: key.encounterId,
  }
}

