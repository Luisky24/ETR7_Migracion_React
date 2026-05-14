/**
 * Transformación de la hoja "Calendario" a estructuras listas para la API/UI:
 * filas tipadas, formato de hora, composición de resultado y estados de alineación.
 *
 * Módulo modularizado: fuente de verdad de formateo para API/UI en este archivo.
 */

/**
 * Formatea la hoja Calendario en filas para la UI.
 * Cada fila: [grupo, local, visitante, hora, campo, resultado, estadoAlineaciones, estadoPartido, referencia_encuentro].
 * referencia_encuentro: se buscan todas las columnas cuya cabecera normalizada es "referencia_encuentro"
 * (misma regla que `hojaIndicesColumnasPorCabeceraNormalizada` / `getIndicesColumnaPorCabeceraCached`);
 * el valor por fila es el de la columna más a la derecha con celda no vacía (`hojaValorReferenciaEncuentroEnFila`).
 */
function formatearCalendarioF1(hoja) {
  // getValues() suele ser más rápido que getDisplayValues(); formateamos hora si es Date.
  var lastRow = hoja.getLastRow();
  if (lastRow < 2) return [];
  var numFilasDatos = lastRow - 1;
  if (numFilasDatos <= 0) return [];
  var lastColH = hoja.getLastColumn();
  var indicesRef = getIndicesColumnaPorCabeceraCached(
    hoja,
    "referencia_encuentro",
  );
  var nColRead = Math.max(11, lastColH);
  // 3.er argumento de getRange(fila, col, numFilas, numCols): número de filas, no índice de última fila.
  var datos = hoja.getRange(2, 1, numFilasDatos, nColRead).getValues();
  var datosCalendario = [];

  var tz = Session.getScriptTimeZone ? Session.getScriptTimeZone() : "GMT";
  function fmtHora(v) {
    if (v == null || v === "") return "";
    if (Object.prototype.toString.call(v) === "[object Date]") {
      return Utilities.formatDate(v, tz, "HH:mm");
    }
    return String(v).trim();
  }

  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    // Columnas 1..11 (0-based):
    // 0 Grupo, 1 Local, 2 Visitante, 3 Hora, 4 Campo, 5 ResL, 6 ResV, 7 EstL, 8 (legacy), 9 EstV, 10 estado_partido
    var grupo = r[0];
    var local = r[1];
    var visitante = r[2];
    var hora = fmtHora(r[3]);
    var campo = r[4];
    var resL = r[5] != null ? r[5] : "";
    var resV = r[6] != null ? r[6] : "";
    var resultado = String(resL) + " - " + String(resV);

    var estL = r[7] == null || r[7] === "" ? "*" : String(r[7]);
    var estV = r[9] == null || r[9] === "" ? "*" : String(r[9]);
    var estadoAlineaciones = String(estL) + " - " + String(estV);

    var estadoPartido =
      r[10] != null && String(r[10]).trim() !== ""
        ? String(r[10]).trim()
        : null;

    var refEncMeta = hojaValorReferenciaEncuentroEnFila(r, indicesRef);

    datosCalendario.push([
      grupo,
      local,
      visitante,
      hora,
      campo,
      resultado,
      estadoAlineaciones,
      estadoPartido,
      refEncMeta,
    ]);
  }

  return datosCalendario;
}
