/**
 * Política A3.5: Alignment REOPENED + workspace.acta ACTIVE ⇒ workflow.actaBinding = SUPERSEDED.
 * Sin I/O; solo transforma el documento workspace (commit posterior en repo).
 */

import type { AlignmentDocumentV1 } from '@/shared/contracts/alignment.document'
import type { EncounterWorkspaceDocumentV1 } from '@/shared/contracts/encounter-workspace.document'

export function shouldSupersedeActaDueToAlignments(
  workspace: EncounterWorkspaceDocumentV1,
  docs: { readonly local?: AlignmentDocumentV1 | null; readonly visitante?: AlignmentDocumentV1 | null },
): { readonly shouldSupersede: boolean; readonly reason?: string; readonly at?: string; readonly by?: string } {
  const hasActiveActa = workspace.acta?.status === 'ACTA_EN_CURSO'
  if (!hasActiveActa) return { shouldSupersede: false }
  if (workspace.workflow.actaBinding === 'SUPERSEDED') return { shouldSupersede: false }

  const reopened = [docs.local, docs.visitante]
    .filter((d): d is AlignmentDocumentV1 => Boolean(d))
    .find((d) => d.lifecycle.state === 'REOPENED')
  if (!reopened) return { shouldSupersede: false }

  const transition = reopened.lifecycle.history.findLast(
    (t) => t.from === 'CLOSED' && t.to === 'REOPENED',
  )
  return {
    shouldSupersede: true,
    reason: transition?.reason ?? 'alignment reopened',
    at: transition?.at,
    by: transition?.by,
  }
}

