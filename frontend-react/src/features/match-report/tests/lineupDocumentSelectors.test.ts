import { describe, expect, it, beforeEach } from 'vitest'
import { clearDocumentRuntimeStore, commitDocumentRuntimeLoad } from '../domain/documentRuntimeStore'
import {
  selectLineupAlignmentRefs,
  selectLineupIsSuperseded,
  selectLineupSnapshots,
  selectLineupStaleState,
  selectLineupTeamViews,
} from '../selectors/lineupDocumentSelectors'
import { emptyMatchReport, minimalEncounterWorkspace } from './fixtures'
import type { EncounterWorkspaceLoadResult } from '../contracts/encounterWorkspaceLoad.contract'

describe('A4.3 lineupDocumentSelectors', () => {
  beforeEach(() => {
    clearDocumentRuntimeStore()
  })

  function seed(superseded = false) {
    const report = emptyMatchReport()
    const workspace = {
      ...minimalEncounterWorkspace(report.context.encuentroId),
      workflow: { actaBinding: superseded ? ('SUPERSEDED' as const) : ('ACTIVE' as const) },
    }
    const result: EncounterWorkspaceLoadResult = {
      source: 'workspace_alignments',
      lifecycle: 'NO_EXISTE',
      report,
      workspace,
      workspaceVersion: 1,
    }
    commitDocumentRuntimeLoad(result)
    return report.context.encuentroId
  }

  it('selectLineupSnapshots deterministic from document', () => {
    const matchId = seed()
    const snaps = selectLineupSnapshots(matchId)
    expect(snaps.local?.side).toBe('local')
    expect(snaps.visitante?.side).toBe('visitante')
    expect(selectLineupAlignmentRefs(matchId)).toEqual(snaps)
  })

  it('selectLineupTeamViews maps workspace players', () => {
    const matchId = seed()
    const views = selectLineupTeamViews(matchId)
    expect(views?.local.teamName).toBe('LOCAL')
    expect(views?.visitante.teamName).toBe('VISITANTE')
  })

  it('selectLineupSuperseded and stale', () => {
    const matchId = seed(true)
    expect(selectLineupIsSuperseded(matchId)).toBe(true)
    const stale = selectLineupStaleState(matchId)
    expect(stale?.findings.some((f) => f.code === 'WORKSPACE_SUPERSEDED')).toBe(true)
  })
})
