/**
 * A4.3 — Selectors documentales para MatchLineups (proyección única sobre documentRuntimeStore).
 */

import type { AlignmentSnapshotProjection } from '../types/matchReportDocumentRuntime.types'
import type {
  RuntimeStaleState,
  RuntimeSupersededState,
} from '../types/matchReportDocumentRuntime.types'
import type { TeamAlignmentDocumentV1 } from '@/shared/contracts/encounter-workspace.document'
import {
  getDocumentRuntimeDocument,
  getDocumentRuntimeEntry,
} from '../domain/documentRuntimeStore'

export interface LineupPlayerRow {
  readonly dorsal: number
  readonly nombre: string
  readonly titular: boolean
  readonly capitan: boolean
}

export interface LineupTeamView {
  readonly teamName: string
  readonly entrenador: string
  readonly delegado: string
  readonly jugadores: readonly LineupPlayerRow[]
  readonly projection: AlignmentSnapshotProjection | null
}

function mapPlayers(team: TeamAlignmentDocumentV1): readonly LineupPlayerRow[] {
  return team.players.map((p) => ({
    dorsal: p.dorsal,
    nombre: p.jugador,
    titular: p.titular,
    capitan: p.capitan,
  }))
}

function teamView(
  team: TeamAlignmentDocumentV1,
  projection: AlignmentSnapshotProjection,
): LineupTeamView {
  return {
    teamName: team.equipo,
    entrenador: team.entrenador,
    delegado: team.delegado,
    jugadores: mapPlayers(team),
    projection,
  }
}

export function selectLineupSnapshots(matchId?: string): {
  readonly local: AlignmentSnapshotProjection | null
  readonly visitante: AlignmentSnapshotProjection | null
} {
  const doc = getDocumentRuntimeDocument(matchId)
  if (!doc) return { local: null, visitante: null }
  return {
    local: doc.projections.local,
    visitante: doc.projections.visitante,
  }
}

export function selectLineupAlignmentRefs(matchId?: string): {
  readonly local: AlignmentSnapshotProjection | null
  readonly visitante: AlignmentSnapshotProjection | null
} {
  return selectLineupSnapshots(matchId)
}

export function selectLineupStaleState(matchId?: string): RuntimeStaleState | null {
  return getDocumentRuntimeDocument(matchId)?.stale ?? null
}

export function selectLineupSupersededState(matchId?: string): RuntimeSupersededState {
  const doc = getDocumentRuntimeDocument(matchId)
  if (!doc) return { isSuperseded: false, actaBinding: 'ACTIVE' }
  return doc.superseded
}

export function selectLineupIsSuperseded(matchId?: string): boolean {
  return selectLineupSupersededState(matchId).isSuperseded
}

export function selectLineupTeamViews(matchId: string): {
  readonly local: LineupTeamView
  readonly visitante: LineupTeamView
} | null {
  const runtime = getDocumentRuntimeEntry(matchId)
  if (!runtime) return null
  const { workspace, document } = runtime
  return {
    local: teamView(workspace.alignments.local, document.projections.local),
    visitante: teamView(workspace.alignments.visitante, document.projections.visitante),
  }
}
