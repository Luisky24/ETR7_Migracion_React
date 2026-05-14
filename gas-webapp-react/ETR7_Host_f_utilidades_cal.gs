/**
 * Subconjunto de utilidades de cabecera/hoja requeridas por el formateador de calendario
 * (copiado de `ETRugby7/utilidades/f_utilidades.js`, sin modificar el monolito).
 *
 * @fileoverview Host React — helpers hoja/cabecera para lectura Calendario v2.
 */

/**
 * Normaliza texto de cabecera: trim, minúsculas, sin acentos, espacios → "_".
 * @param {string} s
 * @returns {string}
 */
function hojaNormalizarNombreCabeceraCal_(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

/**
 * Índices 0-based de todas las columnas cuya cabecera coincide con `nombreClave` tras normalizar.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 * @param {string} nombreClave
 * @returns {number[]}
 */
function hojaIndicesColumnasPorCabeceraNormalizada(hoja, nombreClave) {
  if (!hoja) return [];
  var lc = hoja.getLastColumn();
  if (lc < 1) return [];
  var head = hoja.getRange(1, 1, 1, lc).getDisplayValues()[0] || [];
  var want = hojaNormalizarNombreCabeceraCal_(nombreClave);
  var out = [];
  for (var c = 0; c < head.length; c++) {
    if (hojaNormalizarNombreCabeceraCal_(head[c]) === want) out.push(c);
  }
  return out;
}

/**
 * Entre columnas candidatas (misma cabecera lógica), toma el valor de la columna más a la derecha
 * cuya celda en esta fila no está vacía (trim). Si todas vacías, "".
 * @param {Array} filaValores
 * @param {number[]} indicesRef
 * @returns {string}
 */
function hojaValorReferenciaEncuentroEnFila(filaValores, indicesRef) {
  if (!filaValores || !indicesRef || !indicesRef.length) return "";
  var sorted = indicesRef.slice().sort(function (a, b) {
    return a - b;
  });
  for (var k = sorted.length - 1; k >= 0; k--) {
    var idx = sorted[k];
    if (idx < 0 || idx >= filaValores.length) continue;
    var v = filaValores[idx];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
