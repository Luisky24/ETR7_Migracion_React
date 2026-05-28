/**
 * Catálogo oficial de invariantes del agregado AlignmentDocumentV1 (ALI-*).
 * Solo documentación tipada; la lógica vive en validateAlignmentDocument.
 */

export type InvariantSeverity = 'error' | 'warning'

export type InvariantCategory =
  | 'identity'
  | 'metadata'
  | 'team'
  | 'match'
  | 'players'
  | 'selection'
  | 'lifecycle'
  | 'closure'
  | 'audit'
  | 'sync'
  | 'integrity'
  | 'aggregate'

export interface AlignmentInvariantDefinition {
  readonly id: string
  readonly description: string
  readonly severity: InvariantSeverity
  readonly category: InvariantCategory
}

export const ALIGNMENT_INVARIANTS = [
  {
    id: 'ALI-01',
    description: 'players: playerId únicos (sin duplicados)',
    severity: 'error',
    category: 'players',
  },
  {
    id: 'ALI-02',
    description: 'players: dorsales únicos (sin duplicados)',
    severity: 'error',
    category: 'players',
  },
  {
    id: 'ALI-03',
    description: 'selection: starters ∩ bench = vacío',
    severity: 'error',
    category: 'selection',
  },
  {
    id: 'ALI-04',
    description: 'selection: captain ∈ (starters ∪ bench) si no es null',
    severity: 'error',
    category: 'selection',
  },
  {
    id: 'ALI-05',
    description: 'CLOSED requiere closure.snapshot completo (Acta consume snapshot)',
    severity: 'error',
    category: 'closure',
  },
  {
    id: 'ALI-06',
    description: 'closeRevision monotónico obligatorio (entero >= 1; coherente con historial de cierres)',
    severity: 'error',
    category: 'closure',
  },
  {
    id: 'ALI-07',
    description: 'REOPENED requiere reason en audit y/o lifecycle.history para la transición CLOSED→REOPENED',
    severity: 'error',
    category: 'lifecycle',
  },
  {
    id: 'ALI-08',
    description: 'snapshot coherente: snapshot.selection ids existen en snapshot.players',
    severity: 'error',
    category: 'closure',
  },
  {
    id: 'ALI-09',
    description: 'audit.events append-only estricto (orden temporal no decreciente; sin reescrituras internas)',
    severity: 'error',
    category: 'audit',
  },
  {
    id: 'ALI-10',
    description: 'lifecycle.history append-only (orden temporal no decreciente; transiciones válidas)',
    severity: 'error',
    category: 'lifecycle',
  },
  {
    id: 'ALI-11',
    description: 'Si lifecycle.state === CLOSED entonces closure (con snapshot) es obligatorio y completo',
    severity: 'error',
    category: 'closure',
  },
  {
    id: 'ALI-12',
    description:
      'Si lifecycle.state === CLOSED entonces root.players/root.selection deben coincidir con closure.snapshot (snapshot congela la versión consumible)',
    severity: 'error',
    category: 'closure',
  },
] as const satisfies readonly AlignmentInvariantDefinition[]

export type AlignmentInvariantId = (typeof ALIGNMENT_INVARIANTS)[number]['id']

