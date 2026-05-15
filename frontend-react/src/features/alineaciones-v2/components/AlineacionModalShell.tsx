import type { ReactNode } from 'react'

export type AlineacionModalTone = 'default' | 'success' | 'error'

const BORDER_CLASS: Record<AlineacionModalTone, string> = {
  default: 'border-slate-200',
  success: 'border-emerald-200',
  error: 'border-red-200',
}

interface AlineacionModalShellProps {
  readonly open: boolean
  readonly titleId: string
  readonly descId?: string
  readonly title: string
  readonly description?: ReactNode
  readonly tone?: AlineacionModalTone
  readonly footer: ReactNode
  readonly children?: ReactNode
}

export function AlineacionModalShell({
  open,
  titleId,
  descId,
  title,
  description,
  tone = 'default',
  footer,
  children,
}: AlineacionModalShellProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div
        className={`w-full max-w-md rounded-lg border bg-white p-5 shadow-xl ${BORDER_CLASS[tone]}`}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {description ? (
          <div id={descId} className="mt-2 text-sm text-slate-600">
            {description}
          </div>
        ) : null}
        {children}
        <div className="mt-5">{footer}</div>
      </div>
    </div>
  )
}
