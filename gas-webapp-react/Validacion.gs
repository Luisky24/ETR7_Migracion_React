/**
 * Autenticación legacy: `validarUsuario` (array). Debe mantenerse alineado con
 * `ETRugby7/logger/validación.js` hasta biblioteca compartida.
 * React usa `auth_login_v2` (ver `AuthLoginV2.gs`).
 */

function validarUsuario(claveValidacion) {
  if (claveValidacion == 'Staf') {
    return ['OK', 10]
  }
  if (claveValidacion == 'LCV') {
    return ['OK', 20]
  }
  if (claveValidacion == 'Arbitro') {
    return ['OK', 5]
  }

  try {
    var hojaDatos = obtener_hjInscripcionesEquipos()
    var numfilas = hojaDatos.getLastRow()
    var numcolum = hojaDatos.getLastColumn()
    var listaEquipos = hojaDatos.getRange(1, 1, numfilas, numcolum).getValues()

    for (var ind = 0; ind < listaEquipos.length; ind++) {
      if (listaEquipos[ind][3] == claveValidacion) {
        var nbEquipoM = 'NO'
        var nbEquipoF = 'NO'
        if (listaEquipos[ind][1] >= 10) {
          nbEquipoM = listaEquipos[ind][0]
        }
        if (listaEquipos[ind][2] >= 10) {
          nbEquipoF = listaEquipos[ind][0]
        }
        return ['OK', 7, nbEquipoM, nbEquipoF]
      }
    }
  } catch (e) {
    Logger.log('validarUsuario (equipos): ' + e)
  }
  return ['KO', 0]
}
