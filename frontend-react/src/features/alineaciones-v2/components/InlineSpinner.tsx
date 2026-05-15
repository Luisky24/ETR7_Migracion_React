interface InlineSpinnerProps {
  readonly className?: string
}

/** Spinner compacto para botones y textos inline (sin reflow). */
export function InlineSpinner({ className = '' }: InlineSpinnerProps) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`.trim()}
      aria-hidden
    />
  )
}
