/**
 * A5 — Mensajes UX operacionales (humanos, accionables, federativos).
 */

import type { RuntimeReconcileFinding } from '../tools/runtimeReconcileDiagnostics.contract'

export interface StaleUxCopy {
  readonly title: string
  readonly body: string
  readonly hint: string
}

export interface SupersededUxCopy {
  readonly title: string
  readonly body: string
  readonly hint: string
}

export interface ConcurrentUxCopy {
  readonly title: string
  readonly body: string
  readonly action: string
}

export interface RecoveryUxCopy {
  readonly title: string
  readonly body: string
}

const FINDING_LABELS: Partial<Record<RuntimeReconcileFinding, string>> = {
  ALIGNMENT_STALE_SNAPSHOT: 'la alineación en Workspace no coincide con el snapshot cerrado',
  ALIGNMENT_DOCUMENT_VERSION_MISMATCH: 'la versión del documento cambió',
  WORKSPACE_SUPERSEDED: 'el acta quedó invalidada (alineación reabierta)',
  WORKSPACE_GATE_MISMATCH: 'el estado de cierre de alineaciones no coincide',
  WORKSPACE_ALIGNMENT_REF_MISSING: 'falta referencia documental de alineación cerrada',
  WORKSPACE_ALIGNMENT_LIFECYCLE_INVALID: 'el ciclo de vida de la alineación no es válido',
}

export function buildStaleUxCopy(input?: {
  readonly kinds?: readonly RuntimeReconcileFinding[]
  readonly concurrent?: boolean
}): StaleUxCopy {
  if (input?.concurrent) {
    return {
      title: 'Otro operador guardó cambios antes que usted',
      body: 'Drive tiene una versión más reciente del acta o del Workspace. Sus cambios locales no se han perdido.',
      hint: 'Pulse «Recargar desde Workspace» en el panel superior y revise antes de volver a guardar.',
    }
  }
  const kinds = input?.kinds ?? []
  const detail =
    kinds.length > 0
      ? kinds.map((k) => FINDING_LABELS[k] ?? k).join('; ')
      : 'los datos documentales en pantalla pueden no coincidir con Drive'
  return {
    title: 'Datos documentales desactualizados (stale)',
    body: `Se detectó inconsistencia: ${detail}.`,
    hint: 'Recargue el encuentro para sincronizar con Drive. No cierre el acta hasta estar alineado.',
  }
}

export function buildSupersededUxCopy(): SupersededUxCopy {
  return {
    title: 'Acta invalidada — alineación reabierta',
    body: 'Un delegado reabrió la alineación mientras el acta seguía abierta. Esta revisión del acta ya no es la vigente para edición.',
    hint: 'Recargue desde Workspace para ver el estado federativo actual. Cierre o edición deben hacerse sobre la revisión correcta.',
  }
}

export function buildConcurrentUxCopy(): ConcurrentUxCopy {
  const stale = buildStaleUxCopy({ concurrent: true })
  return {
    title: stale.title,
    body: stale.body,
    action: 'Recargar desde Workspace',
  }
}

export function buildRecoveryUxCopy(input: {
  readonly shouldReload?: boolean
  readonly preserveDirty?: boolean
}): RecoveryUxCopy {
  if (input.shouldReload) {
    return {
      title: 'Se requiere recargar el encuentro',
      body: input.preserveDirty
        ? 'Hay un problema de sincronización. Sus cambios locales se conservan hasta que recargue y vuelva a intentar.'
        : 'Los datos del servidor cambiaron. Recargue para continuar con seguridad.',
    }
  }
  return {
    title: 'Operación no completada',
    body: 'Puede reintentar la acción o recargar el encuentro si el problema continúa.',
  }
}

export function buildLoadingUxLabel(operation: string): string {
  const map: Record<string, string> = {
    loading: 'Cargando acta y Workspace…',
    saving: 'Guardando borrador en Drive…',
    finalizing: 'Cerrando acta y sincronizando calendario…',
  }
  return map[operation] ?? 'Procesando…'
}
