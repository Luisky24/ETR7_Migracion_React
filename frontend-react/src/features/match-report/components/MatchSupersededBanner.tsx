import { buildSupersededUxCopy } from '../ux/uxOperationalMessages'
import { DocumentOperationalBanner } from './DocumentOperationalBanner'

export interface MatchSupersededBannerProps {
  readonly open: boolean
  readonly onReload?: () => void
}

export function MatchSupersededBanner({ open, onReload }: MatchSupersededBannerProps) {
  if (!open) return null
  const copy = buildSupersededUxCopy()
  return (
    <DocumentOperationalBanner
      tone="amber"
      testId="match-superseded-banner"
      title={copy.title}
      body={copy.body}
      hint={copy.hint}
      primaryAction={
        onReload ? { label: 'Recargar desde Workspace', onClick: onReload } : undefined
      }
    />
  )
}
