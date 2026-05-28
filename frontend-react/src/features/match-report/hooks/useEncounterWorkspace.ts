import { useCallback, useState } from 'react'
import type { MatchContext } from '../contracts'
import type { MatchReportDocumentRuntimeState } from '../types/matchReportDocumentRuntime.types'
import { getDocumentRuntimeEntry } from '../domain/documentRuntimeStore'
import { prepareDocumentRuntimeForEncounter } from '../domain/documentRuntimeNavigation'
import { loadDocumentRuntime } from '../services/documentRuntimeLoad.service'

export interface UseEncounterWorkspaceResult {
  readonly document: MatchReportDocumentRuntimeState | null
  readonly matchId: string | null
  readonly loading: boolean
  readonly error: Error | null
  readonly load: (context: MatchContext, options?: { readonly force?: boolean }) => Promise<void>
  readonly reload: (context: MatchContext) => Promise<void>
}

/**
 * A4.3: Hook documental unificado — reutiliza cache/runtime oficial (sin hydrate paralelo).
 */
export function useEncounterWorkspace(
  initialMatchId?: string | null,
): UseEncounterWorkspaceResult {
  const seeded = initialMatchId ? getDocumentRuntimeEntry(initialMatchId)?.document ?? null : null
  const [document, setDocument] = useState<MatchReportDocumentRuntimeState | null>(seeded)
  const [matchId, setMatchId] = useState<string | null>(initialMatchId ?? seeded?.matchId ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(
    async (context: MatchContext, options?: { readonly force?: boolean }) => {
      const cached = getDocumentRuntimeEntry()
      if (cached && cached.matchId !== context.encuentroId) {
        prepareDocumentRuntimeForEncounter(context.encuentroId, cached.matchId)
      }
      setLoading(true)
      setError(null)
      try {
        const entry = await loadDocumentRuntime(context, { force: options?.force })
        setDocument(entry.document)
        setMatchId(entry.matchId)
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const reload = useCallback(
    async (context: MatchContext) => {
      await load(context, { force: true })
    },
    [load],
  )

  return { document, matchId, loading, error, load, reload }
}
