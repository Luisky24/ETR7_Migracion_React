/**
 * Boundary React host: alineaciones v2 (contexto, guardado, confirmación).
 *
 * Resolución dual Phase 4: {@link etr7_shared_resolvePhase1Ns_} + {@link etr7_shared_resolveInfrastructureNs_}.
 *
 * Dependencia de competición (no está en este proyecto fino):
 * - `obtenerAlineacionesEstado` global **o** en la biblioteca `ETR7Competition` (ver `etr7_shared_resolveObtenerAlineacionesEstado_`).
 * - Sin ella, el boundary devuelve equipos vacíos (solo metadatos por parse de id si aplica).
 *
 * @fileoverview ETR7 — ALINEACIONES host (HtmlService); Phase 4 dual runtime.
 */

/**
 * @param {string} categoria
 * @param {string} fase
 * @param {string} encuentroId
 * @return {{version:number, encuentroId:string, local:Object, visitante:Object}}
 */
function alineaciones_getMatchLineups_v2(categoria, fase, encuentroId) {
  var emptyTeam = function (name) {
    return { teamName: name || "", jugadores: [] };
  };
  var empty = {
    version: 2,
    encuentroId: String(encuentroId || ""),
    local: emptyTeam(""),
    visitante: emptyTeam(""),
  };
  var p1 = etr7_shared_resolvePhase1Ns_();
  var inf = etr7_shared_resolveInfrastructureNs_();
  if (
    !p1 ||
    typeof p1.alineacionesGetMatchLineupsV2 !== "function" ||
    !inf ||
    typeof inf.normalizarFase !== "function" ||
    typeof inf.normalizarCategoria !== "function"
  ) {
    return empty;
  }
  var oae =
    typeof etr7_shared_resolveObtenerAlineacionesEstado_ === "function"
      ? etr7_shared_resolveObtenerAlineacionesEstado_()
      : null;
  if (typeof oae !== "function") {
    return empty;
  }
  return p1.alineacionesGetMatchLineupsV2(categoria, fase, encuentroId, {
    normalizarFase: inf.normalizarFase,
    normalizarCategoria: inf.normalizarCategoria,
    obtenerAlineacionesEstado: oae,
  });
}

/**
 * Contexto operativo de alineación (un equipo) — delegación fina Phase1 + legacy SPA.
 *
 * @param {string} requestJson JSON con categoria, fase, recordKey, equipoOperativo, nivelAcceso, sesionEquipo?, matchSnapshot?
 * @return {Object}
 */
function alineaciones_getTeamLineupContext_v2(requestJson) {
  var p1 = etr7_shared_resolvePhase1Ns_();
  var inf = etr7_shared_resolveInfrastructureNs_();
  var spa =
    typeof etr7_shared_resolveObtenerModeloAlineacionCompletoSPA_ === "function"
      ? etr7_shared_resolveObtenerModeloAlineacionCompletoSPA_()
      : null;
  if (
    !p1 ||
    typeof p1.alineacionesGetTeamLineupContextV2 !== "function" ||
    !inf ||
    typeof inf.normalizarFase !== "function" ||
    typeof inf.normalizarCategoria !== "function" ||
    typeof spa !== "function"
  ) {
    var iso = "";
    try {
      iso = new Date().toISOString();
    } catch (e0) {}
    return {
      ok: false,
      error: {
        code: "BOUNDARY_UNAVAILABLE",
        message: "Runtime Phase1 o legacy SPA no disponible.",
      },
      metadata: { version: 2, serverTime: iso, etag: null },
    };
  }
  return p1.alineacionesGetTeamLineupContextV2(String(requestJson || "{}"), {
    obtenerModeloAlineacionCompletoSPA: spa,
    normalizarFase: inf.normalizarFase,
    normalizarCategoria: inf.normalizarCategoria,
  });
}

/**
 * @param {string} requestJson
 * @return {Object}
 */
function alineaciones_saveTeamLineup_v2(requestJson) {
  var p1 = etr7_shared_resolvePhase1Ns_();
  var inf = etr7_shared_resolveInfrastructureNs_();
  var spa =
    typeof etr7_shared_resolveObtenerModeloAlineacionCompletoSPA_ === "function"
      ? etr7_shared_resolveObtenerModeloAlineacionCompletoSPA_()
      : null;
  var gaSpa =
    typeof etr7_shared_resolveGuardarAlineacionSPA_ === "function"
      ? etr7_shared_resolveGuardarAlineacionSPA_()
      : null;
  if (
    !p1 ||
    typeof p1.alineacionesSaveTeamLineupV2 !== "function" ||
    !inf ||
    typeof inf.normalizarFase !== "function" ||
    typeof inf.normalizarCategoria !== "function" ||
    typeof spa !== "function" ||
    typeof gaSpa !== "function"
  ) {
    var iso2 = "";
    try {
      iso2 = new Date().toISOString();
    } catch (e2) {}
    return {
      ok: false,
      error: {
        code: "BOUNDARY_UNAVAILABLE",
        message: "Runtime Phase1, modelo SPA o guardarAlineacionSPA no disponible.",
      },
      metadata: { version: 2, serverTime: iso2, etag: null },
    };
  }
  return p1.alineacionesSaveTeamLineupV2(String(requestJson || "{}"), {
    obtenerModeloAlineacionCompletoSPA: spa,
    guardarAlineacionSPA: gaSpa,
    normalizarFase: inf.normalizarFase,
    normalizarCategoria: inf.normalizarCategoria,
  });
}

/**
 * @param {string} requestJson
 * @return {Object}
 */
function alineaciones_confirmTeamLineup_v2(requestJson) {
  var p1 = etr7_shared_resolvePhase1Ns_();
  var inf = etr7_shared_resolveInfrastructureNs_();
  var spa =
    typeof etr7_shared_resolveObtenerModeloAlineacionCompletoSPA_ === "function"
      ? etr7_shared_resolveObtenerModeloAlineacionCompletoSPA_()
      : null;
  var cfSpa =
    typeof etr7_shared_resolveConfirmarAlineacionSPA_ === "function"
      ? etr7_shared_resolveConfirmarAlineacionSPA_()
      : null;
  if (
    !p1 ||
    typeof p1.alineacionesConfirmTeamLineupV2 !== "function" ||
    !inf ||
    typeof inf.normalizarFase !== "function" ||
    typeof inf.normalizarCategoria !== "function" ||
    typeof spa !== "function" ||
    typeof cfSpa !== "function"
  ) {
    var iso3 = "";
    try {
      iso3 = new Date().toISOString();
    } catch (e3) {}
    return {
      ok: false,
      error: {
        code: "BOUNDARY_UNAVAILABLE",
        message: "Runtime Phase1, modelo SPA o confirmarAlineacionSPA no disponible.",
      },
      metadata: { version: 2, serverTime: iso3, etag: null },
    };
  }
  return p1.alineacionesConfirmTeamLineupV2(String(requestJson || "{}"), {
    obtenerModeloAlineacionCompletoSPA: spa,
    confirmarAlineacionSPA: cfSpa,
    normalizarFase: inf.normalizarFase,
    normalizarCategoria: inf.normalizarCategoria,
  });
}
