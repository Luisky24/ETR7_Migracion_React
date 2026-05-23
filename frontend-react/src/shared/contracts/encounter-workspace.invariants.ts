/**
 * Catálogo oficial de invariantes del agregado Encounter Workspace (WS-*).
 * Solo documentación tipada; la lógica vive en validateEncounterWorkspaceDocument.
 */

export type InvariantSeverity = 'error' | 'warning'

export type InvariantCategory =
  | 'identity'
  | 'acta'
  | 'alignments'
  | 'workflow'
  | 'lifecycle'
  | 'officials'
  | 'sync'
  | 'audit'
  | 'aggregate'
  | 'prohibition'

export interface WorkspaceInvariantDefinition {
  readonly id: string
  readonly description: string
  readonly severity: InvariantSeverity
  readonly category: InvariantCategory
}

export const ENCOUNTER_WORKSPACE_INVARIANTS = [
  {
    id: 'WS-1',
    description: 'Exactamente un workspace por matchId en el repositorio de categoría/fase',
    severity: 'error',
    category: 'identity',
  },
  {
    id: 'WS-2',
    description: 'identity.storageKey === category::phase::matchId',
    severity: 'error',
    category: 'identity',
  },
  {
    id: 'WS-3',
    description: 'identity.encounter.encounterNumber es entero positivo y único por convención de naming',
    severity: 'error',
    category: 'identity',
  },
  {
    id: 'WS-4',
    description: 'calendarRef.rowKey coherente con identity.encounter (grupo, local, visitante)',
    severity: 'error',
    category: 'identity',
  },
  {
    id: 'WS-5',
    description: 'A lo sumo una sección acta operativa; acta null iff sin materialización',
    severity: 'error',
    category: 'acta',
  },
  {
    id: 'WS-6',
    description: 'PROHIBIDO mutar contenido rugby de acta si workflow.actaBinding === SUPERSEDED',
    severity: 'error',
    category: 'acta',
  },
  {
    id: 'WS-7',
    description: 'SUPERSEDED no borra acta; invalida operación, conserva histórico',
    severity: 'error',
    category: 'acta',
  },
  {
    id: 'WS-8',
    description: 'lifecycle.phase acta_closed implica acta.status ACTA_CERRADA cuando acta existe',
    severity: 'error',
    category: 'lifecycle',
  },
  {
    id: 'WS-9',
    description: 'workflow.actaBinding ACTIVE requerido para persistir save draft o close acta',
    severity: 'error',
    category: 'workflow',
  },
  {
    id: 'WS-10',
    description: 'REOPEN_ALIGNMENTS implica actaBinding SUPERSEDED y lastReopen coherente',
    severity: 'error',
    category: 'workflow',
  },
  {
    id: 'WS-11',
    description: 'REOPEN_ACTA implica actaBinding ACTIVE y acta ACTA_EN_CURSO tras comando',
    severity: 'error',
    category: 'workflow',
  },
  {
    id: 'WS-12',
    description: 'PROHIBIDO WORKSPACE_PHASE_RESET libre; solo transiciones por comandos nombrados',
    severity: 'error',
    category: 'lifecycle',
  },
  {
    id: 'WS-13',
    description: 'Dorsales 1–99 sin duplicados por equipo en alignments',
    severity: 'error',
    category: 'alignments',
  },
  {
    id: 'WS-14',
    description: 'Un capitán por equipo y capitán ∈ titulares en alignments',
    severity: 'error',
    category: 'alignments',
  },
  {
    id: 'WS-15',
    description: 'alignments.local.equipo === identity.encounter.equipoLocal (idem visitante)',
    severity: 'error',
    category: 'alignments',
  },
  {
    id: 'WS-16',
    description: 'FIRST_ACTA_MATERIALIZE en producción exige alignments.gate both_closed y alignmentAcceptance',
    severity: 'error',
    category: 'alignments',
  },
  {
    id: 'WS-17',
    description: 'Totales acta coherentes con suma de jugadores por equipo',
    severity: 'error',
    category: 'acta',
  },
  {
    id: 'WS-18',
    description: 'classification.official solo tras cierre; inmutable después',
    severity: 'error',
    category: 'acta',
  },
  {
    id: 'WS-19',
    description: 'acta ACTA_CERRADA congela contenido rugby salvo admin reopen',
    severity: 'error',
    category: 'acta',
  },
  {
    id: 'WS-20',
    description: 'syncKey única por entrada: matchId::v{workspaceVersion}::intent',
    severity: 'error',
    category: 'sync',
  },
  {
    id: 'WS-21',
    description: 'intent close requiere acta cerrada y binding ACTIVE',
    severity: 'error',
    category: 'sync',
  },
  {
    id: 'WS-22',
    description: 'Draft acta save no crea ledger entry close',
    severity: 'error',
    category: 'sync',
  },
  {
    id: 'WS-23',
    description: 'Ningún campo del workspace se infiere solo desde runtime al persistir',
    severity: 'error',
    category: 'aggregate',
  },
  {
    id: 'WS-24',
    description: 'Runtime no muta identity.encounter',
    severity: 'error',
    category: 'identity',
  },
  {
    id: 'WS-25',
    description: 'PROHIBIDO campos legacy*, sheet*, bootstrap*',
    severity: 'error',
    category: 'prohibition',
  },
  {
    id: 'WS-26',
    description: 'PROHIBIDO persistir matchStatus en el workspace',
    severity: 'error',
    category: 'prohibition',
  },
  {
    id: 'WS-27',
    description: 'PROHIBIDO persistir UI state en el workspace',
    severity: 'error',
    category: 'prohibition',
  },
  {
    id: 'WS-28',
    description: 'workflow.alignmentAcceptance implica alignments.gate === both_closed',
    severity: 'error',
    category: 'workflow',
  },
  {
    id: 'WS-29',
    description: 'REOPEN_ALIGNMENTS invalida alignmentAcceptance (no activa con SUPERSEDED)',
    severity: 'error',
    category: 'workflow',
  },
  {
    id: 'WS-30',
    description: 'PROHIBIDO save/close acta editable si actaBinding === SUPERSEDED',
    severity: 'error',
    category: 'workflow',
  },
  {
    id: 'WS-31',
    description: 'lifecycle.phase coherente con deriveWorkspaceLifecyclePhase en commit',
    severity: 'error',
    category: 'lifecycle',
  },
  {
    id: 'WS-32',
    description: 'calendarRef.rowKey coincide con identity.encounter',
    severity: 'error',
    category: 'identity',
  },
  {
    id: 'WS-33',
    description: 'PROHIBIDO auto-propagación alignments → acta sin comando explícito',
    severity: 'error',
    category: 'acta',
  },
  {
    id: 'WS-34',
    description: 'alignments frozen si acta_closed y binding ACTIVE',
    severity: 'error',
    category: 'alignments',
  },
  {
    id: 'WS-35',
    description: 'sync.ledger acotado (máx SYNC_LEDGER_MAX_ENTRIES)',
    severity: 'error',
    category: 'sync',
  },
  {
    id: 'WS-36',
    description: 'officials vacío si acta !== null (pre-acta only)',
    severity: 'error',
    category: 'officials',
  },
  {
    id: 'WS-37',
    description: 'sync.ledger append-only; entradas inmutables',
    severity: 'error',
    category: 'sync',
  },
  {
    id: 'WS-38',
    description: 'metadata.workspaceVersion entero >= 1; monotonicidad en secuencia de commits',
    severity: 'error',
    category: 'aggregate',
  },
  {
    id: 'WS-39',
    description: 'acta inválida FATAL; ledger corrupto degradación controlada',
    severity: 'warning',
    category: 'sync',
  },
  {
    id: 'WS-40',
    description: 'PROHIBIDO ACTA_NEW_REVISION, acta[], múltiples actas operativas',
    severity: 'error',
    category: 'prohibition',
  },
  {
    id: 'WS-41',
    description: 'alignments.gate es la única representación de gate; sin lifecycle.alignmentGate',
    severity: 'error',
    category: 'alignments',
  },
  {
    id: 'WS-42',
    description: 'alignments.gate coherente con estados local/visitante derivados',
    severity: 'error',
    category: 'alignments',
  },
] as const satisfies readonly WorkspaceInvariantDefinition[]

export type WorkspaceInvariantId = (typeof ENCOUNTER_WORKSPACE_INVARIANTS)[number]['id']
