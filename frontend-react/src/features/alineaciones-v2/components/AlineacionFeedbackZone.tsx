import { useMemo } from 'react'

/** Altura fija reservada: evita reflow del listado al cambiar avisos. */
const FEEDBACK_ZONE_HEIGHT = 'h-[4.75rem]'

type FeedbackTone = 'amber' | 'red' | 'neutral'

interface FeedbackLine {
  readonly id: string
  readonly text: string
  readonly tone: FeedbackTone
}

interface AlineacionFeedbackZoneProps {
  readonly softWarnings: readonly string[]
  readonly confirmHardErrors: readonly string[]
  readonly saveError?: string | null
  readonly confirmError?: string | null
  readonly isLockedLineup: boolean
}

const TONE_CLASS: Record<FeedbackTone, string> = {
  amber: 'text-amber-900',
  red: 'text-red-800',
  neutral: 'text-slate-500',
}

const ICON: Record<FeedbackTone, string> = {
  amber: '⚠',
  red: '✕',
  neutral: '·',
}

function buildLines(
  softWarnings: readonly string[],
  confirmHardErrors: readonly string[],
  saveError: string | null | undefined,
  confirmError: string | null | undefined,
  isLockedLineup: boolean,
): FeedbackLine[] {
  const lines: FeedbackLine[] = []

  if (saveError?.trim()) {
    lines.push({ id: 'save', text: saveError.trim(), tone: 'red' })
  }
  if (confirmError?.trim()) {
    lines.push({ id: 'confirm', text: confirmError.trim(), tone: 'red' })
  }
  if (!isLockedLineup) {
    for (const w of softWarnings) {
      lines.push({ id: `soft-${w}`, text: w, tone: 'amber' })
    }
  }
  for (const e of confirmHardErrors) {
    lines.push({ id: `hard-${e}`, text: e, tone: 'red' })
  }

  return lines
}

export function AlineacionFeedbackZone({
  softWarnings,
  confirmHardErrors,
  saveError,
  confirmError,
  isLockedLineup,
}: AlineacionFeedbackZoneProps) {
  const lines = useMemo(
    () => buildLines(softWarnings, confirmHardErrors, saveError, confirmError, isLockedLineup),
    [softWarnings, confirmHardErrors, saveError, confirmError, isLockedLineup],
  )

  const hasMessages = lines.length > 0

  return (
    <section
      className={`${FEEDBACK_ZONE_HEIGHT} shrink-0 rounded-md border border-slate-200 bg-slate-50/90 px-3 py-2`}
      aria-label="Avisos y validación"
      aria-live="polite"
    >
      <div className="flex h-full flex-col overflow-hidden">
        {hasMessages ? (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
            {lines.map((line) => (
              <li
                key={line.id}
                className={`flex items-start gap-1.5 text-xs leading-snug transition-opacity duration-150 ${TONE_CLASS[line.tone]}`}
                title={line.text}
              >
                <span className="mt-px shrink-0 font-semibold opacity-80" aria-hidden>
                  {ICON[line.tone]}
                </span>
                <span className="min-w-0 truncate">{line.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex h-full items-center justify-center text-xs text-slate-400">
            Sin avisos de validación
          </p>
        )}
      </div>
    </section>
  )
}
