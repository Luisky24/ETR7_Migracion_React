import type {
  LoadMatchReportRequest,
  LoadMatchReportResponse,
  MatchClosureResult,
  MatchPersistenceDTO,
  MatchReport,
} from '../contracts'
import {
  gasCloseMatchReport,
  gasLoadMatchReport,
  gasSaveMatchReportDraft,
} from './matchReport.service.gas'
import {
  mockCloseMatchReport,
  mockLoadMatchReport,
  mockSaveDraft,
} from './mock/matchReportMock'

export type MatchReportServiceMode = 'mock' | 'gas'

/** Contrato único de persistencia del acta (mock | GAS). */
export interface MatchReportActiveService {
  readonly loadMatchReport: (request: LoadMatchReportRequest) => Promise<LoadMatchReportResponse>
  readonly saveMatchReportDraft: (
    dto: MatchPersistenceDTO,
    report: MatchReport,
  ) => Promise<{ readonly ok: true; readonly report: MatchReport }>
  readonly closeMatchReport: (dto: MatchPersistenceDTO, report: MatchReport) => Promise<MatchClosureResult>
}

const mockService: MatchReportActiveService = {
  loadMatchReport: mockLoadMatchReport,
  saveMatchReportDraft: mockSaveDraft,
  closeMatchReport: mockCloseMatchReport,
}

const gasService: MatchReportActiveService = {
  loadMatchReport: gasLoadMatchReport,
  saveMatchReportDraft: gasSaveMatchReportDraft,
  closeMatchReport: gasCloseMatchReport,
}

let serviceMode: MatchReportServiceMode = 'mock'

export function setMatchReportServiceMode(mode: MatchReportServiceMode): void {
  serviceMode = mode
}

export function getMatchReportServiceMode(): MatchReportServiceMode {
  return serviceMode
}

/** Resuelve la implementación activa sin duplicar ramas en cada API pública. */
export function getActiveService(): MatchReportActiveService {
  return serviceMode === 'mock' ? mockService : gasService
}

export async function loadMatchReport(
  request: LoadMatchReportRequest,
): Promise<LoadMatchReportResponse> {
  return getActiveService().loadMatchReport(request)
}

export async function saveMatchReportDraft(
  dto: MatchPersistenceDTO,
  report: MatchReport,
): Promise<{ readonly ok: true; readonly report: MatchReport }> {
  return getActiveService().saveMatchReportDraft(dto, report)
}

export async function closeMatchReport(
  dto: MatchPersistenceDTO,
  report: MatchReport,
): Promise<MatchClosureResult> {
  return getActiveService().closeMatchReport(dto, report)
}
