/**
 * Boundary React host: `calendar_getMatches_v2` (contrato estable).
 *
 * Resolución dual Phase 4: {@link etr7_shared_resolvePhase1Ns_} + {@link etr7_shared_resolveInfrastructureNs_}.
 * Sigue requiriendo `obtenerDatosInformacion` del monolito (fusión o biblioteca de competición).
 *
 * @fileoverview ETR7 — CALENDAR host (HtmlService); Phase 4 dual runtime.
 */

/**
 * @param {string} categoria
 * @param {string} fase
 * @return {{version:number, matches:Array<Object>}}
 */
function calendar_getMatches_v2(categoria, fase) {
  var empty = { version: 2, matches: [] };
  var p1 = etr7_shared_resolvePhase1Ns_();
  var inf = etr7_shared_resolveInfrastructureNs_();
  if (
    !p1 ||
    typeof p1.calendarGetMatchesV2 !== "function" ||
    !inf ||
    typeof inf.normalizarFase !== "function" ||
    typeof inf.normalizarCategoria !== "function"
  ) {
    return empty;
  }
  var odi = typeof etr7_shared_resolveObtenerDatosInformacion_ === "function" ? etr7_shared_resolveObtenerDatosInformacion_() : null;
  if (typeof odi !== "function") {
    return empty;
  }
  return p1.calendarGetMatchesV2(categoria, fase, {
    normalizarFase: inf.normalizarFase,
    normalizarCategoria: inf.normalizarCategoria,
    obtenerDatosInformacion: odi,
  });
}
