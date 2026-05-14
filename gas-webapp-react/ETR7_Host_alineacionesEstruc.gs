/**
 * Lectura mínima de hoja ENC_* → modelo alineación (copia de `funcionesACTA.js`, solo SPA).
 * Host React autónomo; no incluye guardar acta ni PDF.
 *
 * @fileoverview ETR7_Host — obtenerEstrucAlineacion + helper hora.
 */

/**
 * @param {*} dato
 * @return {string|undefined}
 */
function obtenerHHMMdesdeDate(dato) {
  var horaDate = dato;
  var horaMinutos;
  if (horaDate instanceof Date) {
    var horas = horaDate.getHours().toString();
    if (horas.length < 2) {
      horas = "0" + horas;
    }
    var minutos = horaDate.getMinutes().toString();
    if (minutos.length < 2) {
      minutos = "0" + minutos;
    }
    horaMinutos = horas + ":" + minutos;
  }
  return horaMinutos;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 * @return {Object}
 */
function obtenerEstrucAlineacion(hoja) {
  var numFilas = hoja.getLastRow();
  var alineacion = hoja.getRange(1, 1, numFilas, 10).getValues();

  var alineacionEstructurada = {
    numFilaCalendario: alineacion[0][1],
    categoria: alineacion[1][1],
    equipo: alineacion[2][1],
    fase: alineacion[3][1],
    grupo: alineacion[4][1],
    contrario: alineacion[5][1],
    encuentro: alineacion[6][1],
    indLocalVisitante: alineacion[7][1],
    campo: alineacion[8][1],
    hora: obtenerHHMMdesdeDate(alineacion[9][1]),
    estado: alineacion[10][1],
    delegado: alineacion[11][1],
    entrenador: alineacion[12][1],
    jugadores: [],
    datosEstructura: ["", ""],
  };

  var juagadoresAlineacion = [];
  if (alineacion[13][0] === "JUGADORES") {
    var indJugadores = 14;
    while (alineacion[indJugadores][0] !== "DATOS") {
      var jugador;
      if (alineacion[indJugadores][0] !== "") {
        jugador = [
          alineacion[indJugadores][0],
          alineacion[indJugadores][1],
          alineacion[indJugadores][2],
          alineacion[indJugadores][3],
          Number(alineacion[indJugadores][4]),
        ];
        juagadoresAlineacion.push(jugador);
      }
      indJugadores++;
    }
  }

  alineacionEstructurada.jugadores.push.apply(
    alineacionEstructurada.jugadores,
    juagadoresAlineacion,
  );
  return alineacionEstructurada;
}
