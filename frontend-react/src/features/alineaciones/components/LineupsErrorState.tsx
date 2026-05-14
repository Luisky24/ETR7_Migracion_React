interface LineupsErrorStateProps {
  readonly message: string
  readonly onRetry: () => void
}

export function LineupsErrorState({ message, onRetry }: LineupsErrorStateProps) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <p>{message}</p>
      <button
        type="button"
        className="mt-2 text-sm font-medium text-red-800 underline-offset-2 hover:underline"
        onClick={onRetry}
      >
        Reintentar
      </button>
    </div>
  )
}
