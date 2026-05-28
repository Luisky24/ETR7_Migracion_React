import type { RuntimeStaleState } from '../types/matchReportDocumentRuntime.types'
import { buildStaleUxCopy } from '../ux/uxOperationalMessages'
import { DocumentOperationalBanner } from './DocumentOperationalBanner'

export interface MatchStaleDocumentBannerProps {
  readonly stale: RuntimeStaleState | null
  readonly concurrent?: boolean
  readonly onReload?: () => void
}

export function MatchStaleDocumentBanner({ stale, concurrent, onReload }: MatchStaleDocumentBannerProps) {
  if (!stale?.isStale && !concurrent) return null
  const copy = buildStaleUxCopy({ kinds: stale?.kinds, concurrent })
  return (
    <DocumentOperationalBanner
      tone="orange"
      testId="match-stale-banner"
      title={copy.title}
      body={copy.body}
      hint={copy.hint}
      primaryAction={
        onReload
          ? { label: 'Recargar desde Workspace', onClick: onReload }
          : undefined
      }
    />
  )
}
