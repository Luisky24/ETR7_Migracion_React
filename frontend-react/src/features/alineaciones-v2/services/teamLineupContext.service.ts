import { log } from '@/core/debug'
import { gasTransport } from '@/transport/gasTransport'
import { adaptTeamLineupContextWire, adaptTeamLineupSaveWire } from '../adapters/teamLineupContext.adapter'
import type {
  TeamLineupConfirmRequest,
  TeamLineupConfirmWire,
  TeamLineupContextRequest,
  TeamLineupContextWire,
  TeamLineupSaveRequest,
  TeamLineupSaveWire,
} from '../contracts/teamLineupContext.contract'

const GAS_GET = 'alineaciones_getTeamLineupContext_v2'
const GAS_SAVE = 'alineaciones_saveTeamLineup_v2'
const GAS_CONFIRM = 'alineaciones_confirmTeamLineup_v2'

export const teamLineupContextService = {
  async getContext(request: TeamLineupContextRequest): Promise<TeamLineupContextWire | null> {
    const payload = JSON.stringify(request)
    log.debug('teamLineupContext.getContext.start', { recordKey: request.recordKey, equipo: request.equipoOperativo })
    try {
      const raw: unknown = await gasTransport.call(GAS_GET, payload)
      const adapted = adaptTeamLineupContextWire(raw)
      log.debug('teamLineupContext.getContext.done', { ok: adapted?.ok })
      return adapted
    } catch (e) {
      log.error('teamLineupContext.getContext.error', {
        message: e instanceof Error ? e.message : String(e),
      })
      throw e
    }
  },

  async save(request: TeamLineupSaveRequest): Promise<TeamLineupSaveWire | null> {
    const payload = JSON.stringify(request)
    log.debug('teamLineupContext.save.start', { recordKey: request.recordKey })
    try {
      const raw: unknown = await gasTransport.call(GAS_SAVE, payload)
      return adaptTeamLineupSaveWire(raw)
    } catch (e) {
      log.error('teamLineupContext.save.error', {
        message: e instanceof Error ? e.message : String(e),
      })
      throw e
    }
  },

  async confirm(request: TeamLineupConfirmRequest): Promise<TeamLineupConfirmWire | null> {
    const payload = JSON.stringify(request)
    log.debug('teamLineupContext.confirm.start', { recordKey: request.recordKey })
    try {
      const raw: unknown = await gasTransport.call(GAS_CONFIRM, payload)
      return adaptTeamLineupSaveWire(raw)
    } catch (e) {
      log.error('teamLineupContext.confirm.error', {
        message: e instanceof Error ? e.message : String(e),
      })
      throw e
    }
  },
}
