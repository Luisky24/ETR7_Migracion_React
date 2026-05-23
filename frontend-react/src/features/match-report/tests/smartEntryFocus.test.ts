import { describe, expect, it } from 'vitest'
import {
  resolveDialogKeyAction,
  shouldAutoSelectOnFocus,
} from '../presentation/smartEntryFocus'

describe('smart entry focus', () => {
  it('shouldAutoSelectOnFocus solo en foco por teclado', () => {
    expect(shouldAutoSelectOnFocus('keyboard')).toBe(true)
    expect(shouldAutoSelectOnFocus('pointer')).toBe(false)
  })

  it('resolveDialogKeyAction: Enter confirma, Escape cancela', () => {
    expect(
      resolveDialogKeyAction('Enter', { hasConfirm: true, busy: false }),
    ).toBe('confirm')
    expect(
      resolveDialogKeyAction('Escape', { hasConfirm: true, busy: false }),
    ).toBe('cancel')
    expect(
      resolveDialogKeyAction('Enter', { hasConfirm: true, busy: true }),
    ).toBeNull()
  })

  it('resolveDialogKeyAction: Enter cierra modal de un solo botón', () => {
    expect(
      resolveDialogKeyAction('Enter', {
        hasConfirm: false,
        busy: false,
        allowEnterDismiss: true,
      }),
    ).toBe('cancel')
  })
})
