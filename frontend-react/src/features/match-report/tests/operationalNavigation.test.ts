import { describe, expect, it } from 'vitest'
import { resolveNextActionCell } from '../components/MatchActionsTable'

describe('operational keyboard navigation', () => {
  it('Enter avanza por columnas y salta a siguiente fila', () => {
    const bounds = { rows: 3, cols: 4 }
    expect(resolveNextActionCell({ row: 0, col: 0 }, 'next', bounds)).toEqual({ row: 0, col: 1 })
    expect(resolveNextActionCell({ row: 0, col: 3 }, 'next', bounds)).toEqual({ row: 1, col: 0 })
    expect(resolveNextActionCell({ row: 2, col: 3 }, 'next', bounds)).toEqual({ row: 2, col: 3 })
  })

  it('Shift+Enter retrocede por columnas y vuelve a fila anterior', () => {
    const bounds = { rows: 3, cols: 4 }
    expect(resolveNextActionCell({ row: 1, col: 2 }, 'prev', bounds)).toEqual({ row: 1, col: 1 })
    expect(resolveNextActionCell({ row: 1, col: 0 }, 'prev', bounds)).toEqual({ row: 0, col: 3 })
    expect(resolveNextActionCell({ row: 0, col: 0 }, 'prev', bounds)).toEqual({ row: 0, col: 0 })
  })
})

