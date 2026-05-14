/**
 * Índice ScriptProperties ENC_SHEET::libroId::idEncuentro + resolución por nombre hoja.
 * Copia de `ETRugby7/00_alineacionesIndex.js` (host React).
 *
 * @fileoverview ETR7_Host — índice hojas ENC por libro equipo.
 */

/** Solo si ScriptProperties `ETR7_DEBUG_LINEUPS_V2` = `1`. */
function _host_encLineupsV2DebugEnabled_() {
  try {
    return (
      String(PropertiesService.getScriptProperties().getProperty("ETR7_DEBUG_LINEUPS_V2") || "")
        .trim() === "1"
    );
  } catch (e) {
    return false;
  }
}

/**
 * Sufijo oficial del partido en nombre de hoja: `EquipoLocal - EquipoVisitante` (espacios alrededor de "-").
 * @param {string} local
 * @param {string} visitante
 * @return {string}
 */
function _host_suffixPartidoExacto_(local, visitante) {
  return String(local != null ? local : "").trim() + " - " + String(visitante != null ? visitante : "").trim();
}

/**
 * Parsea `ENC_<ordinal>_<resto>` con ordinal 1–99; `resto` es todo lo que sigue al primer `_` tras el ordinal.
 * @param {string} name
 * @return {{ord:number, rest:string}|null}
 */
function _host_parseOrdAndRestFromEncSheetName_(name) {
  var n = String(name || "");
  if (n.indexOf("ENC_") !== 0) return null;
  var after = n.substring(4);
  var u = after.indexOf("_");
  if (u < 0) return null;
  var ordStr = after.substring(0, u);
  var ord = parseInt(ordStr, 10);
  if (!isFinite(ord) || ord < 1 || ord > 99) return null;
  var rest = after.substring(u + 1);
  return { ord: ord, rest: rest };
}

/**
 * Todas las hojas cuyo nombre cumple ENC_* con mismo sufijo de partido que el calendario.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} libroOpen
 * @param {string} suffixPartido
 * @return {Array<{sheet:GoogleAppsScript.Spreadsheet.Sheet, name:string, ord:number}>}
 */
function _host_collectEncSheetsExactPartido_(libroOpen, suffixPartido) {
  var out = [];
  if (!libroOpen || suffixPartido == null) return out;
  var want = String(suffixPartido);
  var sheets = libroOpen.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var nm = sh.getName();
    var pr = _host_parseOrdAndRestFromEncSheetName_(nm);
    if (!pr) continue;
    if (pr.rest === want) {
      out.push({ sheet: sh, name: nm, ord: pr.ord });
    }
  }
  return out;
}

function _alineacionSheetIndexKey_(libroID, idEncuentro) {
  return "ENC_SHEET::" + String(libroID || "") + "::" + String(idEncuentro || "");
}

function _getAlineacionSheetFromIndex_(libroOpen, libroID, idEncuentro) {
  try {
    if (!libroOpen || !libroID || !idEncuentro) return null;
    var props = PropertiesService.getScriptProperties();
    var key = _alineacionSheetIndexKey_(libroID, idEncuentro);
    var sheetName = props.getProperty(key);
    if (!sheetName) return null;
    var sh = libroOpen.getSheetByName(sheetName);
    return sh || null;
  } catch (e) {
    console.log("_getAlineacionSheetFromIndex_ error: " + (e && e.message ? e.message : e));
    return null;
  }
}

function _setAlineacionSheetIndex_(libroID, idEncuentro, sheetName) {
  try {
    if (!libroID || !idEncuentro || !sheetName) return;
    var props = PropertiesService.getScriptProperties();
    var key = _alineacionSheetIndexKey_(libroID, idEncuentro);
    props.setProperty(key, String(sheetName));
  } catch (e) {
    console.log("_setAlineacionSheetIndex_ error: " + (e && e.message ? e.message : e));
  }
}

function _obtenerHojaAlineacionPorLocalVisitanteEnLibro_(libroOpen, equipoLocal, equipoVisitante) {
  if (!libroOpen) return null;
  var hojas = libroOpen.getSheets();
  var coincidencias = [];
  var localBuscado = String(equipoLocal || "").trim();
  var visitanteBuscado = String(equipoVisitante || "").trim();
  var sep = " - ";
  for (var hi = 0; hi < hojas.length; hi++) {
    var hoja = hojas[hi];
    var nombre = hoja.getName();
    if (nombre.indexOf("ENC_") !== 0) continue;
    var partes = nombre.split("_");
    if (partes.length < 3) continue;
    var encuentroStr = partes.slice(2).join("_").trim();
    var idx = encuentroStr.indexOf(sep);
    if (idx === -1) continue;
    var localNombre = encuentroStr.substring(0, idx).trim();
    var visitanteNombre = encuentroStr.substring(idx + sep.length).trim();
    if (localNombre === localBuscado && visitanteNombre === visitanteBuscado) {
      coincidencias.push(hoja);
    }
  }
  return coincidencias.length === 1 ? coincidencias[0] : null;
}
