export type DocumentOperationalBannerTone = 'amber' | 'orange' | 'red' | 'sky'

const TONE_CLASS: Record<
  DocumentOperationalBannerTone,
  { border: string; bg: string; title: string; body: string; button: string }
> = {
  amber: {
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    title: 'text-amber-950',
    body: 'text-amber-900',
    button:
      'rounded border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100/50',
  },
  orange: {
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    title: 'text-orange-950',
    body: 'text-orange-900',
    button:
      'rounded border border-orange-400 bg-white px-3 py-1.5 text-sm font-medium text-orange-950 hover:bg-orange-100/50',
  },
  red: {
    border: 'border-red-300',
    bg: 'bg-red-50',
    title: 'text-red-950',
    body: 'text-red-900',
    button:
      'rounded border border-red-400 bg-white px-3 py-1.5 text-sm font-medium text-red-950 hover:bg-red-100/50',
  },
  sky: {
    border: 'border-sky-300',
    bg: 'bg-sky-50',
    title: 'text-sky-950',
    body: 'text-sky-900',
    button:
      'rounded border border-sky-400 bg-white px-3 py-1.5 text-sm font-medium text-sky-950 hover:bg-sky-100/50',
  },
}

export interface DocumentOperationalBannerProps {
  readonly tone: DocumentOperationalBannerTone
  readonly title: string
  readonly body: string
  readonly hint?: string
  readonly testId?: string
  readonly primaryAction?: { readonly label: string; readonly onClick: () => void }
  readonly secondaryAction?: { readonly label: string; readonly onClick: () => void }
}

export function DocumentOperationalBanner({
  tone,
  title,
  body,
  hint,
  testId,
  primaryAction,
  secondaryAction,
}: DocumentOperationalBannerProps) {
  const c = TONE_CLASS[tone]
  return (
    <section
      role="status"
      aria-live="polite"
      data-testid={testId}
      className={`rounded-lg border px-4 py-3 ${c.border} ${c.bg}`}
    >
      <p className={`text-sm font-semibold ${c.title}`}>{title}</p>
      <p className={`mt-1 text-sm ${c.body}`}>{body}</p>
      {hint ? <p className={`mt-2 text-xs ${c.body}`}>{hint}</p> : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {primaryAction ? (
            <button type="button" className={c.button} onClick={primaryAction.onClick}>
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button type="button" className={c.button} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
