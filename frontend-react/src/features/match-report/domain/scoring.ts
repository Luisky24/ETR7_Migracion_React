import type {
  MatchActionSummary,
  MatchReport,
  MatchScore,
  MatchTeam,
  PlayerMatchActions,
  PlayerMatchLine,
  TeamTotals,
} from '../contracts'
import { computeClientClassificationPreview } from './classification'
import {
  POINTS_PER_CONVERSION,
  POINTS_PER_PENALTY_KICK,
  POINTS_PER_TRY,
} from './constants'

/** Desglose de marcador deportivo por equipo. */
export interface TeamScoringBreakdown {
  readonly tries: number
  readonly conversions: number
  readonly penaltyKicks: number
  readonly tryPoints: number
  readonly conversionPoints: number
  readonly penaltyKickPoints: number
  /** Puntos a favor (PF) — marcador deportivo del equipo. */
  readonly pointsFor: number
}

export interface MatchScoringResult {
  readonly local: TeamScoringBreakdown
  readonly visitante: TeamScoringBreakdown
  readonly score: MatchScore
  readonly actionSummary: MatchActionSummary
}

const ZERO_TOTALS: TeamTotals = { E: 0, T: 0, PC: 0, Tar: 0 }

export function emptyTeamTotals(): TeamTotals {
  return { ...ZERO_TOTALS }
}

export function sumPlayerActions(players: readonly PlayerMatchLine[]): TeamTotals {
  return players
    .filter((p) => p.isTitularOrSuplente)
    .reduce(
      (acc, p) => ({
        E: acc.E + p.actions.E,
        T: acc.T + p.actions.T,
        PC: acc.PC + p.actions.PC,
        Tar: acc.Tar + p.actions.Tar,
      }),
      emptyTeamTotals(),
    )
}

export function countActionsInTotals(totals: TeamTotals): number {
  return totals.E + totals.T + totals.PC + totals.Tar
}

export function buildActionSummary(
  localPlayers: readonly PlayerMatchLine[],
  visitantePlayers: readonly PlayerMatchLine[],
): MatchActionSummary {
  const localTotals = sumPlayerActions(localPlayers)
  const visitanteTotals = sumPlayerActions(visitantePlayers)
  const totalActionsCount =
    countActionsInTotals(localTotals) + countActionsInTotals(visitanteTotals)
  return {
    hasAnyAction: totalActionsCount > 0,
    totalActionsCount,
    localTotals,
    visitanteTotals,
  }
}

export function computeTeamScoreFromTotals(totals: TeamTotals): number {
  return (
    totals.E * POINTS_PER_TRY +
    totals.T * POINTS_PER_CONVERSION +
    totals.PC * POINTS_PER_PENALTY_KICK
  )
}

export function computeTeamScoringBreakdown(totals: TeamTotals): TeamScoringBreakdown {
  const tryPoints = totals.E * POINTS_PER_TRY
  const conversionPoints = totals.T * POINTS_PER_CONVERSION
  const penaltyKickPoints = totals.PC * POINTS_PER_PENALTY_KICK
  return {
    tries: totals.E,
    conversions: totals.T,
    penaltyKicks: totals.PC,
    tryPoints,
    conversionPoints,
    penaltyKickPoints,
    pointsFor: tryPoints + conversionPoints + penaltyKickPoints,
  }
}

export function computeMatchScoreFromTotals(
  localTotals: TeamTotals,
  visitanteTotals: TeamTotals,
): MatchScore {
  return {
    local: computeTeamScoreFromTotals(localTotals),
    visitante: computeTeamScoreFromTotals(visitanteTotals),
  }
}

export function computeMatchScore(
  localPlayers: readonly PlayerMatchLine[],
  visitantePlayers: readonly PlayerMatchLine[],
): MatchScore {
  const summary = buildActionSummary(localPlayers, visitantePlayers)
  return computeMatchScoreFromTotals(summary.localTotals, summary.visitanteTotals)
}

export function computeFullMatchScoring(
  localPlayers: readonly PlayerMatchLine[],
  visitantePlayers: readonly PlayerMatchLine[],
  scoreOverride?: MatchScore,
): MatchScoringResult {
  const actionSummary = buildActionSummary(localPlayers, visitantePlayers)
  const score =
    scoreOverride ??
    computeMatchScoreFromTotals(actionSummary.localTotals, actionSummary.visitanteTotals)

  return {
    local: computeTeamScoringBreakdown(actionSummary.localTotals),
    visitante: computeTeamScoringBreakdown(actionSummary.visitanteTotals),
    score,
    actionSummary,
  }
}

function patchTeamFromScoring(
  team: MatchTeam,
  totals: TeamTotals,
  classification: import('../contracts').MatchClassification,
): MatchTeam {
  return {
    ...team,
    totals,
    classification,
  }
}

/** Recalcula totals, marcador y clasificación preview sobre un informe completo. */
export function recalculateMatchReport(
  report: MatchReport,
  options?: { readonly scoreOverride?: MatchScore },
): MatchReport {
  const scoring = computeFullMatchScoring(
    report.local.players,
    report.visitante.players,
    options?.scoreOverride,
  )
  const classificationPreview = computeClientClassificationPreview(scoring.score, {
    hasAnyAction: scoring.actionSummary.hasAnyAction,
  })

  return {
    ...report,
    score: scoring.score,
    local: patchTeamFromScoring(
      report.local,
      scoring.actionSummary.localTotals,
      classificationPreview.local,
    ),
    visitante: patchTeamFromScoring(
      report.visitante,
      scoring.actionSummary.visitanteTotals,
      classificationPreview.visitante,
    ),
  }
}

export function patchPlayerActions(
  players: readonly PlayerMatchLine[],
  playerId: string,
  patch: Partial<PlayerMatchActions>,
): readonly PlayerMatchLine[] {
  return players.map((p) =>
    p.playerId === playerId
      ? {
          ...p,
          actions: {
            E: patch.E ?? p.actions.E,
            T: patch.T ?? p.actions.T,
            PC: patch.PC ?? p.actions.PC,
            Tar: patch.Tar ?? p.actions.Tar,
          },
        }
      : p,
  )
}

export type { MatchResult } from './matchResult'
export { resolveMatchResult } from './matchResult'
