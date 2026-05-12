/**
 * Parseo defensivo de la respuesta cruda de `obtenerDatosInformacion` (Calendario).
 * Solo estructura; sin índices de columnas de fila (eso vive en el mapper de fila).
 */

export interface LegacyCalendarRowsPayload {
  readonly rowsReadonly: readonly unknown[]
}

/** Extrae filas legacy sin validar aún cada fila. */
export function parseObtenerDatosInformacionPayload(raw: unknown): LegacyCalendarRowsPayload {
  if (raw == null) {
    return { rowsReadonly: [] }
  }

  if (Array.isArray(raw)) {
    return { rowsReadonly: raw as readonly unknown[] }
  }

  if (typeof raw === 'object') {
    const obj = raw as { version?: unknown; filas?: unknown }
    if (obj.version === 2 && Array.isArray(obj.filas)) {
      return { rowsReadonly: obj.filas as readonly unknown[] }
    }
  }

  return { rowsReadonly: [] }
}
