# ETR7 React — Revisión de arquitectura (consolidación React ↔ GAS)

Revisión orientada a **validación manual** y detección temprana de acoplamientos. No sustituye auditorías de seguridad o rendimiento.

## Fortalezas

- **Transporte único**: `gasTransport` / `callGas` concentran `google.script.run`; fallos registrados con `logTransportFailure` (visible aunque `VITE_ETR7_DEBUG` esté off).
- **Calendario en feature slice**: contratos, adapters, mappers, service y hook bajo `src/features/calendar/`; la UI de página/componentes no importa transport ni adapters.
- **Auth**: `authAdapter` encapsula respuesta legacy de `validarUsuario`; `authService` es fachada fina; sesión en `SessionContext`.
- **Capabilities**: modelo explícito (`UserCapabilities`, `hasCapability`) sin niveles numéricos en UI.
- **Routing**: rutas en `AppRouter` + `ROUTES`; guards (`AuthGuard`, `GuestGuard`) separados del feature calendario.

## Boundaries verificados (estado actual)

| Capa | Conoce GAS / transport | Conoce arrays legacy |
|------|------------------------|----------------------|
| UI (`pages`, `features/.../components`) | No | No |
| Hooks (`useCalendarMatches`) | No (solo service) | No |
| `calendar.service` | Sí (`gasTransport`) | No |
| `calendar.adapter` + mappers | No directamente | Sí (solo ahí) |
| `gasTransport` | Sí | N/A |

## Hallazgos / deuda técnica temprana

1. **`SessionContext` / `isSessionReady`**: fijado a `true` con estado inicial leído de `sessionStorage` en el inicializador de `useState`. La fase `lifecycle: 'bootstrap'` del contrato existe pero **no se usa** en runtime; documentado para evitar confusiones futuras.
2. **`useCalendarMatches`**: usa `window.setTimeout` para diferir el primer fetch (compatibilidad ESLint). Comportamiento correcto; revisar si en el futuro se prefiere patrón explícito “fetch on demand” sin `window` en tests.
3. **`Object.values` en `CalendarMatchesPage`**: convierte el mapa de DTOs en lista para la tabla; orden depende del motor JS; aceptable hasta que el contrato exponga orden estable (p. ej. `orderedIds`).
4. **`authService.logout`**: stub sin efecto remoto (por diseño actual); sesión se limpia en cliente. Coherente con alcance actual.

## Imports / acoplamientos cruzados

- `gasTransport` aparece solo en: `transport/gasTransport.ts`, `adapters/authAdapter.ts`, `features/calendar/services/calendar.service.ts`. **No** en páginas ni componentes de calendario.
- `window` en transporte y tipos `gas.d.ts`: acotado al boundary; esperado.

## Riesgos

| Nivel | Riesgo | Mitigación corta |
|-------|--------|-------------------|
| Medio | Bundle GAS vs límite de tamaño por archivo Apps Script | Vigilar tamaño de `Assets_js.html`; pipeline documentado en `gas-webapp-react/README.md`. |
| Medio | Doble invocación de efectos en React StrictMode (dev) | Logs duplicados en dev; aceptable para validación. |
| Bajo | Logs de debug en producción si se fuerza `VITE_ETR7_DEBUG=true` | Usar solo en builds de prueba; no en producción final sin revisar PII. |

## Mejoras futuras (sin hacer en esta fase)

- Error boundary raíz por ruta o por layout.
- Orden explícito de filas en `CalendarMatchesResponse`.
- Tests E2E o contrato contra mock de `google.script.run`.
- Telemetría externa (fuera de alcance explícito del proyecto).

## Conclusión

El patrón **UI → hook → service → adapter → transport → GAS** está **alineado** con el código actual: la UI React no conoce arrays legacy ni `google.script.run` directamente; el transporte falla de forma **observable** para validación manual.
