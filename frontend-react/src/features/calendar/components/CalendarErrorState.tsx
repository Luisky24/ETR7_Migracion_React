interface CalendarErrorStateProps {
  readonly message: string
  readonly onRetry?: () => void
}

export function CalendarErrorState({ message, onRetry }: CalendarErrorStateProps) {
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50/90 px-4 py-6 text-center"
      role="alert"
    >
      <p className="text-sm font-medium text-red-900">No se pudieron cargar los datos</p>
      <p className="mt-2 text-sm text-red-800/90">{message}</p>
      {onRetry ? (
        <button
          type="button"
          className="mt-4 rounded-md bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-900"
          onClick={onRetry}
        >
          Reintentar
        </button>
      ) : null}
    </div>
  )
}
