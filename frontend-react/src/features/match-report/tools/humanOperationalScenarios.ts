/**
 * A5 — Escenarios operacionales humanos (smoke manual en staging GAS real).
 * Complementa stagingRuntimeOperational (automático sin I/O GAS).
 */

export type HumanOperationalPersona = 'delegado' | 'arbitro' | 'operador' | 'doble_sesion'

export type HumanOperationalScenarioCode =
  | 'HO_DELEGADO_ALINEACION'
  | 'HO_ARBITRO_ACTA'
  | 'HO_OPERADOR_DIAGNOSTICS'
  | 'HO_DOBLE_SESION_CONFLICT'

export interface HumanOperationalScenario {
  readonly code: HumanOperationalScenarioCode
  readonly persona: HumanOperationalPersona
  readonly title: string
  readonly steps: readonly string[]
  readonly expected: readonly string[]
  readonly uxSignals: readonly string[]
}

export const HUMAN_OPERATIONAL_SCENARIOS: readonly HumanOperationalScenario[] = [
  {
    code: 'HO_DELEGADO_ALINEACION',
    persona: 'delegado',
    title: 'Ciclo alineación: abrir → editar → cerrar → reabrir → cerrar',
    steps: [
      'Abrir alineación del encuentro desde calendario (vista alineaciones o flujo delegado).',
      'Editar jugadores y cerrar alineación (snapshot CLOSED en Drive).',
      'Reabrir alineación, modificar y volver a cerrar.',
    ],
    expected: [
      'Workspace refleja gate both_closed tras cada cierre.',
      'Si hay acta abierta, acta pasa a SUPERSEDED con banner ámbar en acta y alineaciones.',
      'Recargar sincroniza proyección sin corrupción de datos.',
    ],
    uxSignals: ['[UX-SUPERSEDED] banner.visible', 'match-superseded-banner', 'lineups: MatchSupersededBanner'],
  },
  {
    code: 'HO_ARBITRO_ACTA',
    persona: 'arbitro',
    title: 'Acta: hydrate → editar → guardar → cerrar',
    steps: [
      'Abrir acta del encuentro (estado partido permitido).',
      'Verificar marcador y acciones cargados desde Workspace.',
      'Guardar borrador y cerrar acta.',
    ],
    expected: [
      'Hydrate único (sin pantalla vacía prolongada).',
      'Etiquetas loading/saving/finalizing comprensibles.',
      'Tras cierre, acta en solo lectura.',
    ],
    uxSignals: ['match-operation-busy', 'buildLoadingUxLabel'],
  },
  {
    code: 'HO_OPERADOR_DIAGNOSTICS',
    persona: 'operador',
    title: 'Soporte: __ETR7_DOC__ en staging',
    steps: [
      'En WebApp staging-gas, abrir acta de un encuentro.',
      'Consola: __ETR7_DOC__.help()',
      'Ejecutar dumpStaleState() y runReconcile()',
    ],
    expected: [
      'help() lista comandos sin error.',
      'findings y staleGraph correlables con banners en pantalla.',
    ],
    uxSignals: ['[RUNTIME-DOC]', '[RUNTIME-STALE]', '[RUNTIME-RECONCILE]'],
  },
  {
    code: 'HO_DOBLE_SESION_CONFLICT',
    persona: 'doble_sesion',
    title: 'Dos operadores: guardado concurrente',
    steps: [
      'Sesión A: abrir acta, editar marcador, no guardar aún.',
      'Sesión B: abrir mismo encuentro, guardar cambios.',
      'Sesión A: intentar guardar.',
    ],
    expected: [
      'Banner naranja stale/concurrent visible.',
      'Guardado bloqueado; mensaje DOCUMENT_VERSION_CONFLICT accionable.',
      'Recargar conserva dirty local si policy lo indica.',
      'No overwrite silencioso.',
    ],
    uxSignals: [
      '[UX-CONCURRENT]',
      'match-stale-banner',
      'DOCUMENT_VERSION_CONFLICT',
    ],
  },
]

export function listHumanOperationalScenarios(): readonly HumanOperationalScenario[] {
  return HUMAN_OPERATIONAL_SCENARIOS
}
