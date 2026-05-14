interface LineupsEmptyStateProps {
  readonly message: string
}

export function LineupsEmptyState({ message }: LineupsEmptyStateProps) {
  return (
    <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</p>
  )
}
