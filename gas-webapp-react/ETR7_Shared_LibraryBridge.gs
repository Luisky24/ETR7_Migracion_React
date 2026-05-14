/**
 * Puente LOCAL (symlinks / .gs en el proyecto) ↔ LIBRARY (biblioteca GAS enlazada).
 *
 * Script Property opcional: `ETR7_SHARED_RUNTIME_SOURCE` = `LOCAL` | `LIBRARY`
 * - `LOCAL` (o vacío): usar globales `ETR7_Shared_*` del propio proyecto (modo DEV actual).
 * - `LIBRARY`: usar `ETR7Shared.ETR7_Shared_*` (identificador de biblioteca al añadir la lib en el IDE).
 *
 * Phase 4 — piloto; no publica biblioteca; solo permite que hosts finos resuelvan el runtime.
 *
 * @fileoverview ETR7 — resolución dual de namespaces shared.
 */

/**
 * @return {string}
 */
function etr7_shared_runtimeSourceProperty_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty("ETR7_SHARED_RUNTIME_SOURCE") || "")
      .trim()
      .toUpperCase();
  } catch (e) {
    return "";
  }
}

/**
 * Detecta modo de despliegue para informes (selfcheck). Sin side effects.
 *
 * @return {"LOCAL_SHARED_MODE"|"LIBRARY_MODE"|"AMBIGUOUS"|"UNKNOWN"|"LIBRARY_MODE_MISSING"}
 */
function etr7_shared_runtimeDeployment_probe_v1_() {
  var hasLocalP1 =
    typeof ETR7_Shared_Phase1 !== "undefined" &&
    ETR7_Shared_Phase1 !== null &&
    typeof ETR7_Shared_Phase1.authLoginV2 === "function";
  var hasLibP1 =
    typeof ETR7Shared !== "undefined" &&
    ETR7Shared !== null &&
    typeof ETR7Shared.ETR7_Shared_Phase1 === "object" &&
    ETR7Shared.ETR7_Shared_Phase1 !== null &&
    typeof ETR7Shared.ETR7_Shared_Phase1.authLoginV2 === "function";

  if (hasLocalP1 && hasLibP1) {
    return "AMBIGUOUS";
  }

  var prop = etr7_shared_runtimeSourceProperty_();
  if (prop === "LIBRARY") {
    return hasLibP1 ? "LIBRARY_MODE" : "LIBRARY_MODE_MISSING";
  }

  if (hasLibP1 && !hasLocalP1) {
    return "LIBRARY_MODE";
  }

  if (hasLocalP1) {
    return "LOCAL_SHARED_MODE";
  }

  return "UNKNOWN";
}

/**
 * Resuelve el namespace Phase1 (local o vía biblioteca `ETR7Shared`).
 * @return {Object|null}
 */
function etr7_shared_resolvePhase1Ns_() {
  var prop = etr7_shared_runtimeSourceProperty_();
  if (prop === "LIBRARY") {
    if (typeof ETR7Shared !== "undefined" && ETR7Shared && ETR7Shared.ETR7_Shared_Phase1) {
      return ETR7Shared.ETR7_Shared_Phase1;
    }
    return null;
  }
  if (typeof ETR7_Shared_Phase1 !== "undefined" && ETR7_Shared_Phase1) {
    return ETR7_Shared_Phase1;
  }
  if (typeof ETR7Shared !== "undefined" && ETR7Shared && ETR7Shared.ETR7_Shared_Phase1) {
    return ETR7Shared.ETR7_Shared_Phase1;
  }
  return null;
}

/**
 * Resuelve el namespace Infrastructure (local o vía biblioteca `ETR7Shared`).
 * @return {Object|null}
 */
function etr7_shared_resolveInfrastructureNs_() {
  var prop = etr7_shared_runtimeSourceProperty_();
  if (prop === "LIBRARY") {
    if (typeof ETR7Shared !== "undefined" && ETR7Shared && ETR7Shared.ETR7_Shared_Infrastructure) {
      return ETR7Shared.ETR7_Shared_Infrastructure;
    }
    return null;
  }
  if (typeof ETR7_Shared_Infrastructure !== "undefined" && ETR7_Shared_Infrastructure) {
    return ETR7_Shared_Infrastructure;
  }
  if (typeof ETR7Shared !== "undefined" && ETR7Shared && ETR7Shared.ETR7_Shared_Infrastructure) {
    return ETR7Shared.ETR7_Shared_Infrastructure;
  }
  return null;
}

/**
 * Símbolo IDE de la biblioteca de competición (monolito `ETRugby7` publicado como lib).
 * Script Property opcional: `ETR7_COMPETITION_LIBRARY_SYMBOL` (default `ETR7Competition`).
 * @return {string}
 */
function etr7_shared_competitionLibrarySymbol_() {
  var def = "ETR7Competition";
  try {
    var p = PropertiesService.getScriptProperties().getProperty("ETR7_COMPETITION_LIBRARY_SYMBOL");
    if (p != null && String(p).trim() !== "") {
      return String(p).trim();
    }
  } catch (e) {}
  return def;
}

/**
 * Raíz del objeto biblioteca de competición (`ETR7Competition`, etc.) o null.
 * @return {Object|null}
 */
function etr7_shared_competitionLibraryRoot_() {
  var sym = etr7_shared_competitionLibrarySymbol_();
  var root = typeof globalThis !== "undefined" ? globalThis : this;
  try {
    var lib = root[sym];
    if (lib != null && typeof lib === "object") {
      return lib;
    }
  } catch (e) {}
  return null;
}

/**
 * Resuelve `obtenerDatosInformacion` para el boundary calendario: global del host (fusión)
 * o función homónima en la biblioteca de competición (`ETR7Competition.obtenerDatosInformacion`).
 *
 * @return {function(string,string,string):*|null}
 */
function etr7_shared_resolveObtenerDatosInformacion_() {
  if (typeof obtenerDatosInformacion === "function") {
    return obtenerDatosInformacion;
  }
  var comp = etr7_shared_competitionLibraryRoot_();
  if (comp && typeof comp.obtenerDatosInformacion === "function") {
    return comp.obtenerDatosInformacion;
  }
  return null;
}

/**
 * Resuelve `obtenerAlineacionesEstado` para el boundary alineaciones: global del host (fusión)
 * o función homónima en la biblioteca de competición.
 *
 * @return {function(Array):*|null}
 */
function etr7_shared_resolveObtenerAlineacionesEstado_() {
  if (typeof obtenerAlineacionesEstado === "function") {
    return obtenerAlineacionesEstado;
  }
  var comp = etr7_shared_competitionLibraryRoot_();
  if (comp && typeof comp.obtenerAlineacionesEstado === "function") {
    return comp.obtenerAlineacionesEstado;
  }
  return null;
}

/**
 * Busca una función pública en la raíz de un objeto librería o un nivel bajo contenedores habituales.
 * Algunos hosts agrupan APIs bajo subobjetos; el monolito legacy expone la SPA en la raíz.
 *
 * @param {Object|null} root
 * @param {string} functionName
 * @return {function(...*):*|null}
 */
function etr7_shared_pickFromLibraryRoot_(root, functionName) {
  if (!root || typeof root !== "object" || !functionName) {
    return null;
  }
  try {
    if (typeof root[functionName] === "function") {
      return root[functionName];
    }
  } catch (e0) {
    return null;
  }
  var nests = ["alineaciones", "Alineaciones", "Services", "services", "API", "api"];
  for (var i = 0; i < nests.length; i++) {
    try {
      var sub = root[nests[i]];
      if (sub && typeof sub === "object" && typeof sub[functionName] === "function") {
        return sub[functionName];
      }
    } catch (e1) {}
  }
  return null;
}

/**
 * Resuelve `obtenerModeloAlineacionCompletoSPA` para el boundary de contexto operativo por equipo.
 * Global del host (fusión) o homónima en la biblioteca de competición (raíz o anidada).
 * También intenta el símbolo global `ETRugby7` si difiere de {@link etr7_shared_competitionLibrarySymbol_}.
 *
 * @return {function(Object):*|null}
 */
function etr7_shared_resolveObtenerModeloAlineacionCompletoSPA_() {
  try {
    if (typeof obtenerModeloAlineacionCompletoSPA === "function") {
      return obtenerModeloAlineacionCompletoSPA;
    }
  } catch (eGlob) {}
  var candidates = [];
  try {
    var comp = etr7_shared_competitionLibraryRoot_();
    if (comp) {
      candidates.push(comp);
    }
  } catch (eC) {}
  try {
    var g = typeof globalThis !== "undefined" ? globalThis : this;
    var alt = g && g["ETRugby7"] ? g["ETRugby7"] : null;
    if (alt) {
      var dup = false;
      for (var d = 0; d < candidates.length; d++) {
        if (candidates[d] === alt) {
          dup = true;
          break;
        }
      }
      if (!dup) {
        candidates.push(alt);
      }
    }
  } catch (eG) {}
  for (var ci = 0; ci < candidates.length; ci++) {
    var fn = etr7_shared_pickFromLibraryRoot_(candidates[ci], "obtenerModeloAlineacionCompletoSPA");
    if (typeof fn === "function") {
      return fn;
    }
  }
  return null;
}

/**
 * Resuelve `guardarAlineacionSPA` (adaptador legacy SPA → writer + calendario P→E).
 * @return {function(Object):void|null}
 */
function etr7_shared_resolveGuardarAlineacionSPA_() {
  if (typeof guardarAlineacionSPA === "function") {
    return guardarAlineacionSPA;
  }
  var comp = etr7_shared_competitionLibraryRoot_();
  if (comp && typeof comp.guardarAlineacionSPA === "function") {
    return comp.guardarAlineacionSPA;
  }
  return null;
}

/**
 * Resuelve `confirmarAlineacionSPA` (adaptador legacy SPA → confirmación + calendario/acta).
 * @return {function(Object):void|null}
 */
function etr7_shared_resolveConfirmarAlineacionSPA_() {
  if (typeof confirmarAlineacionSPA === "function") {
    return confirmarAlineacionSPA;
  }
  var comp = etr7_shared_competitionLibraryRoot_();
  if (comp && typeof comp.confirmarAlineacionSPA === "function") {
    return comp.confirmarAlineacionSPA;
  }
  return null;
}

/**
 * Resuelve `normalizarFase` (global host o biblioteca de competición).
 * @return {function(string):string|null}
 */
function etr7_shared_resolveNormalizarFase_() {
  if (typeof normalizarFase === "function") {
    return normalizarFase;
  }
  var comp = etr7_shared_competitionLibraryRoot_();
  if (comp && typeof comp.normalizarFase === "function") {
    return comp.normalizarFase;
  }
  return null;
}

/**
 * Resuelve `normalizarCategoria` (global host o biblioteca de competición).
 * @return {function(string):string|null}
 */
function etr7_shared_resolveNormalizarCategoria_() {
  if (typeof normalizarCategoria === "function") {
    return normalizarCategoria;
  }
  var comp = etr7_shared_competitionLibraryRoot_();
  if (comp && typeof comp.normalizarCategoria === "function") {
    return comp.normalizarCategoria;
  }
  return null;
}
