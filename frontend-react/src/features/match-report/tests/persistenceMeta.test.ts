import { describe, expect, it } from 'vitest'
import { buildActaDocumentV1 } from '../utils/actaDocument'
import { buildMatchPersistenceDto } from '../utils/persistenceDto'
import { normalizeRefereeName } from '../utils/referee'
import { emptyMatchReport } from './fixtures'

describe('persistence meta fields', () => {
  it('buildMatchPersistenceDto incluye árbitro y observaciones', () => {
    const report = {
      ...emptyMatchReport(),
      referee: { name: 'Juan Pérez' },
      incidencias: 'Lluvia',
      local: { ...emptyMatchReport().local, observaciones: 'Obs L' },
      visitante: { ...emptyMatchReport().visitante, observaciones: 'Obs V' },
    }
    const dto = buildMatchPersistenceDto(report, false)
    expect(dto.referee?.name).toBe('Juan Pérez')
    expect(dto.incidencias).toBe('Lluvia')
    expect(dto.observacionesLocal).toBe('Obs L')
    expect(dto.observacionesVisitante).toBe('Obs V')
  })

  it('normalizeRefereeName descarta vacío', () => {
    expect(normalizeRefereeName('  ')).toBeUndefined()
    expect(normalizeRefereeName(' Ana ')).toEqual({ name: 'Ana' })
  })

  it('buildActaDocumentV1 proyecta DTO para JSON futuro', () => {
    const report = { ...emptyMatchReport(), referee: { name: 'Ref' } }
    const dto = buildMatchPersistenceDto(report, true)
    const doc = buildActaDocumentV1(dto, report)
    expect(doc.version).toBe(1)
    expect(doc.referee?.name).toBe('Ref')
    expect(doc.observacionesLocal).toBe('')
  })
})
