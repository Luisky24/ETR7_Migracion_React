import type {
  LoadMatchReportRequest,
  LoadMatchReportResponse,
  MatchClosureResult,
  MatchPersistenceDTO,
  MatchReport,
} from '../../contracts'
import { recalculateMatchReport } from '../../domain'
import { assertQaRuntimeSimulation } from '../../utils/qaRuntimeSimulation'
import { emptyMatchReport } from '../../tests/fixtures'

const delay = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms))

export async function mockLoadMatchReport(
  request: LoadMatchReportRequest,
): Promise<LoadMatchReportResponse> {
  assertQaRuntimeSimulation('load')
  await delay()
  const base = emptyMatchReport(request.context)
  const report = recalculateMatchReport(base)
  return {
    report,
    cerrada: report.cerrada,
    fromActaSnapshot: false,
  }
}

export async function mockSaveDraft(
  _dto: MatchPersistenceDTO,
  report: MatchReport,
): Promise<{ readonly ok: true; readonly report: MatchReport }> {
  assertQaRuntimeSimulation('save')
  await delay()
  return { ok: true, report: recalculateMatchReport(report) }
}

export async function mockCloseMatchReport(
  _dto: MatchPersistenceDTO,
  report: MatchReport,
): Promise<MatchClosureResult> {
  assertQaRuntimeSimulation('finalize')
  await delay(120)
  const closed = recalculateMatchReport({
    ...report,
    cerrada: true,
    editability: 'read_only',
  })
  return {
    ok: true,
    cerrada: true,
    serverClassification: {
      local: closed.local.classification,
      visitante: closed.visitante.classification,
    },
  }
}
