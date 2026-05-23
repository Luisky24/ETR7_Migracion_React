/** Última celda de acción enfocada (restauración tras modales/operaciones). */
let lastActionInputKey: string | null = null

const inputRegistry = new Map<string, HTMLInputElement>()

export function registerActionInput(key: string, el: HTMLInputElement | null): void {
  if (!el) {
    inputRegistry.delete(key)
    return
  }
  inputRegistry.set(key, el)
}

export function rememberActionInputFocus(key: string): void {
  lastActionInputKey = key
}

export function restoreActionInputFocus(options?: { selectAll?: boolean }): boolean {
  if (!lastActionInputKey) return false
  const el = inputRegistry.get(lastActionInputKey)
  if (!el) return false
  el.focus()
  if (options?.selectAll !== false) {
    selectInputValue(el)
  }
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  return true
}

export function focusFirstActionInput(side: 'local' | 'visitante' = 'local'): boolean {
  const el = document.querySelector<HTMLInputElement>(
    `[data-match-action-input][data-side="${side}"]:not(:disabled)`,
  )
  if (!el) return false
  el.focus()
  selectInputValue(el)
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  rememberActionInputFocus(el.dataset.actionKey ?? '')
  return true
}

/** Selecciona todo el valor del input (reemplazo inmediato al teclear). */
export function selectInputValue(el: HTMLInputElement): void {
  try {
    el.select()
  } catch {
    // Safari/iOS pueden fallar en inputs numéricos; ignorar.
  }
}

export type FocusIntent = 'keyboard' | 'pointer'

/**
 * Indica si conviene auto-seleccionar al recibir foco.
 * - pointer: el usuario hizo click para posicionar cursor → no seleccionar.
 * - keyboard: TAB, Enter, navegación programática → seleccionar.
 */
export function shouldAutoSelectOnFocus(intent: FocusIntent): boolean {
  return intent === 'keyboard'
}

/** Evita que la rueda del ratón cambie valores en inputs numéricos enfocados. */
export function preventWheelChangeValue(el: HTMLInputElement): void {
  if (document.activeElement === el) {
    el.blur()
  }
}

export function getDialogFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

export function handleDialogFocusTrap(
  e: KeyboardEvent,
  container: HTMLElement,
): void {
  if (e.key !== 'Tab') return
  const focusable = getDialogFocusableElements(container)
  if (focusable.length === 0) return

  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  const active = document.activeElement as HTMLElement | null

  if (e.shiftKey) {
    if (active === first || !container.contains(active)) {
      e.preventDefault()
      last.focus()
    }
  } else if (active === last) {
    e.preventDefault()
    first.focus()
  }
}

export function resolveDialogKeyAction(
  key: string,
  options: Readonly<{ hasConfirm: boolean; busy: boolean; allowEnterDismiss?: boolean }>,
): 'confirm' | 'cancel' | null {
  if (options.busy) return null
  if (key === 'Escape') return 'cancel'
  if (key === 'Enter' && options.hasConfirm) return 'confirm'
  if (key === 'Enter' && options.allowEnterDismiss) return 'cancel'
  return null
}
