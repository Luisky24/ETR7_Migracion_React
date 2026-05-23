# Actas JSON — Checklist operacional staging (ETR7)

Hardening previo a activar persistencia JSON por defecto en producción.  
**No sustituye** pruebas automáticas; complementa validación manual federativa.

---

## Herramienta de diagnóstico

```txt
frontend-react/src/features/match-report/tools/reconcileActaCalendar.ts
```

- **Solo diagnostica** — no muta JSON ni Sheets.
- Entrada: documento JSON + snapshot Calendario + Resultados_* + ledger `calendarSync` + opcional COPA/PDF.
- Salida: `ActaCalendarReconcileReport` (`OK` | `WARNING` | `ERROR` | `FATAL`).

Uso típico en staging (script/consola tras cargar snapshots de lectura):

```ts
import { reconcileActaCalendar, formatReconcileReport } from '@/features/match-report/tools/reconcileActaCalendar'

const report = reconcileActaCalendar({ matchId, document, calendar, resultados, syncLedger })
console.log(formatReconcileReport(report))
```

---

## Flujos críticos a validar

### 1. Bootstrap legacy

| Verificar | Esperado |
|-----------|----------|
| Sin JSON válido / binding no ACTIVE | Carga alineaciones + acta legacy |
| `matchStatus` desde Calendario | Coherente con fila Calendario |
| No hidrata JSON SUPERSEDED | `shouldHydrateFromJsonDocument === false` |

### 2. Bootstrap JSON

| Verificar | Esperado |
|-----------|----------|
| JSON ACTIVE + válido | Hidrata `MatchReport` desde documento |
| Classification | No recalculada si `ACTA_CERRADA` (freeze F14) |
| Versión documento | Coincide con probe/read |

### 3. Save draft

| Verificar | Esperado |
|-----------|----------|
| `ACTA_EN_CURSO` | `actaJson_atomicWrite` draft OK |
| `documentVersion` | Incrementa en cada save |
| Calendario | **Sin sync** en draft (opción A) |
| Ledger sync | Sin entrada `close` hasta cierre |

### 4. Close acta

| Verificar | Esperado |
|-----------|----------|
| JSON | `status === ACTA_CERRADA`, `closedAt`, classification oficial si aplica |
| Calendario | `estado_partido = acta_cerrada`, marcador cols 5-6 |
| Resultados_* | Filas LV/VL escritas |
| Clasificación global | Recalculada tras sync |
| COPA F2 | Placeholders revertidos si aplica |
| Sync ledger | `close` → `SUCCESS` para `v{documentVersion}` |
| Runtime | `LOCK_REPORT` tras close OK |

### 5. Reopen acta

| Verificar | Esperado |
|-----------|----------|
| JSON | `ACTA_EN_CURSO`, `actaBinding ACTIVE`, audit `REOPEN_ACTA` |
| Calendario | `acta_abierta`, marcador vacío, alineaciones C/C |
| Resultados_* | Filas borradas |
| PDF | Eliminado / columna PDF limpia |
| JSON documental | **No borrado** — única verdad documental |

### 6. Reopen alignments

| Verificar | Esperado |
|-----------|----------|
| JSON metadata | `actaBinding SUPERSEDED`, `lastReopen REOPEN_ALIGNMENTS` |
| Calendario | `alineacion_parcial`, ENC P/E según alcance |
| Resultados_* | Limpios |
| PDF | No presente |
| Bootstrap siguiente | Legacy (no hydrate JSON SUPERSEDED) |

### 7. Re-close tras reopen

| Verificar | Esperado |
|-----------|----------|
| Nuevo `documentVersion` | Sync `close` con nueva clave idempotente |
| Estado final | Misma checklist que **Close acta** |
| SUPERSEDED resuelto upstream | Admin JSON antes de nuevo ciclo si aplica |

### 8. SUPERSEDED bootstrap

| Verificar | Esperado |
|-----------|----------|
| Probe JSON | Documento puede existir |
| Bootstrap | Fallback legacy alineaciones |
| Reconcile | Sin `SUPERSEDED_HYDRATE_CONFLICT` |

### 9. Calendar sync fail

| Verificar | Esperado |
|-----------|----------|
| JSON persistido | OK (sync async no bloquea) |
| Ledger | `FAILED` + `lastError` |
| Calendario | Puede quedar desfasado — usar reconcile |
| Logs GAS | `[calendarSyncHost]` + `[calendarSyncTransport]` |

### 10. Version conflict

| Verificar | Esperado |
|-----------|----------|
| Cliente stale | Error F5 / conflicto optimista |
| Sin overwrite silencioso | Re-load documento |
| Reconcile | No mezclar versiones en sync key |

### 11. Corrupt document

| Verificar | Esperado |
|-----------|----------|
| Parse / validación | `FATAL` en reconcile |
| Bootstrap | Fallback legacy o error controlado |
| Recovery | Restaurar JSON desde backup (manual) |

### 12. Recovery manual

Ver sección [Recovery manual recomendado](#recovery-manual-recomendado).

---

## Qué verificar tras cada flujo (resumen)

```txt
Calendario actualizado
Resultados limpiados / escritos según intent
COPA revertida (F2)
classification congelada en JSON si cerrada
PDF eliminado tras reopen
sync ledger SUCCESS (o duplicate idempotente)
reconcileActaCalendar → OK o WARNING justificado
```

---

## Known inconsistent states

| Estado | Síntoma | Diagnóstico reconcile |
|--------|---------|------------------------|
| JSON cerrado + Calendario abierto | `JSON_CLOSED_CALENDAR_OPEN` | Sync close fallido o reopen operacional sin JSON |
| SUPERSEDED no aplicado | `REOPEN_ALIGNMENTS_BINDING` | Metadata sin `actaBinding SUPERSEDED` |
| SUPERSEDED + hydrate | `SUPERSEDED_HYDRATE_CONFLICT` | Binding incorrecto en JSON |
| Sync FAILED | `SYNC_FAILED` / `SYNC_LEDGER_FAILED` | Ledger + logs GAS |
| Resultados huérfanos | `RESULTADOS_ORPHAN_ROWS` | Reopen sin borrar Resultados_* |
| Marcador fantasma | `MARKER_NOT_CLEARED` | Reopen sin limpiar cols 5-6 |
| PDF tras reopen | `PDF_SHOULD_BE_ABSENT` | PDF en Drive o columna PDF |
| Clasificación desalineada | `CLASSIFICATION_RESULTADOS_MISMATCH` | Re-sync close o recalc global |
| COPA F2 | `COPA_PLACEHOLDERS_PENDING` | Revert COPA antes de continuar |

---

## Recovery manual recomendado

**Sin autorepair automático** en esta fase.

1. **Ejecutar** `reconcileActaCalendar` con snapshots actuales y guardar reporte.
2. **Priorizar** issues `FATAL` / `ERROR` antes que `WARNING`.
3. **JSON** — corregir solo vía flujos oficiales (`actaJson_atomicWrite`, admin metadata) o restaurar archivo Drive; no editar Sheets para “arreglar” JSON.
4. **Calendario / Resultados** — alinear manualmente o re-disparar sync con intent correcto (`close`, `reopen_acta`, `reopen_alignments`, `alignment_complete`) tras corregir JSON.
5. **Sync duplicado** — `syncKey` idempotente en GAS: segunda aplicación = success silencioso; no forzar doble escritura.
6. **SUPERSEDED** — confirmar binding en JSON; operación alineaciones vía legacy hasta nuevo documento ACTIVE.
7. **Documentar** incidencia: matchId, `documentVersion`, intent, código reconcile, timestamp.

---

## Activación progresiva recomendada

| Entorno | `VITE_ETR7_ACTA_PERSISTENCE` | Notas |
|---------|------------------------------|--------|
| dev local | `json` | Mock GAS + reconcile manual |
| staging | `hybrid` | JSON + sync GAS real; checklist completa |
| producción inicial | `legacy` | Sin cambio usuario hasta sign-off |
| producción estable | `hybrid` → `json` | Tras N encuentros sin ERROR reconcile |

Criterio de paso staging → producción hybrid:

- Checklist flujos 1–12 ejecutada en muestra representativa (Fase I + Fase II/COPA).
- Reconcile sin `FATAL`; `ERROR` justificados y resueltos.
- Sync ledger `SUCCESS` en cierres de prueba.
- Equipo operaciones formaado en recovery manual.

---

## Referencias

| Componente | Ubicación |
|------------|-----------|
| Reconcile tool | `src/features/match-report/tools/reconcileActaCalendar.ts` |
| Tests reconcile | `src/features/match-report/tests/reconcileActaCalendar.test.ts` |
| Calendar sync GAS | `gas-webapp-react/ETR7_Host_calendarSync.gs` |
| Encounter workflow | `src/features/match-report/utils/encounterWorkflow.ts` |
| Estrategia migración | `docs/MIGRATION_STRATEGY.md` |

---

*Última revisión: fase hardening operacional post calendar sync GAS.*
