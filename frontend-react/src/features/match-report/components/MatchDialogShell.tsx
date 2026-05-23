import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import {
  getDialogFocusableElements,
  handleDialogFocusTrap,
  resolveDialogKeyAction,
} from '../presentation/smartEntryFocus'

export interface MatchDialogShellProps {
  readonly open: boolean
  readonly titleId: string
  readonly title: string
  readonly children: ReactNode
  readonly footer: ReactNode
  readonly onBackdropClick?: () => void
  readonly busy?: boolean
  /** Escape o clic fuera → cancelar. */
  readonly onCancel?: () => void
  /** Enter confirma acción principal (si no está busy). */
  readonly onConfirm?: () => void
  /** Al abrir, enfoca el botón con data-dialog-primary o el primero del footer. */
  readonly autoFocusPrimary?: boolean
  /** Restaurar foco al elemento previo al cerrar (por defecto true). */
  readonly restoreFocusOnClose?: boolean
}

export function MatchDialogShell({
  open,
  titleId,
  title,
  children,
  footer,
  onBackdropClick,
  busy = false,
  onCancel,
  onConfirm,
  autoFocusPrimary = true,
  restoreFocusOnClose = true,
}: MatchDialogShellProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const panel = panelRef.current
    if (!panel) return

    const raf = requestAnimationFrame(() => {
      const primary = panel.querySelector<HTMLElement>('[data-dialog-primary]')
      const focusable = getDialogFocusableElements(panel)
      const target =
        (autoFocusPrimary && primary) || focusable[0] || panel.querySelector<HTMLElement>('button')
      target?.focus()
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (!panelRef.current) return
      handleDialogFocusTrap(e, panelRef.current)

      const action = resolveDialogKeyAction(e.key, {
        hasConfirm: !!onConfirm,
        busy,
        allowEnterDismiss: !onConfirm && !!onCancel,
      })
      if (action === 'cancel' && onCancel) {
        e.preventDefault()
        onCancel()
      } else if (action === 'confirm' && onConfirm) {
        e.preventDefault()
        onConfirm()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown)
      if (restoreFocusOnClose) {
        const el = restoreFocusRef.current
        if (el?.isConnected) {
          el.focus()
        }
      }
    }
  }, [open, busy, onCancel, onConfirm, autoFocusPrimary, restoreFocusOnClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-slate-900/40"
        aria-hidden
        onClick={busy || !onBackdropClick ? undefined : onBackdropClick}
      />
      <div
        ref={panelRef}
        className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-lg sm:max-w-lg sm:p-5"
      >
        <h2 id={titleId} className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        <div className="mt-3 flex-1 overflow-y-auto pr-1">{children}</div>
        <div className="mt-4 shrink-0">{footer}</div>
      </div>
    </div>
  )
}
