/**
 * Resuelve la hoja de inscripciones para la rama "equipo" de validarUsuario.
 * Configuración opcional por propiedades del script (mismo libro que legacy si se desea).
 *
 * Propiedades (Project Settings → Script properties):
 * - ETR7_INSCRIPCIONES_SPREADSHEET_ID — ID del spreadsheet (obligatoria para login equipo).
 * - ETR7_INSCRIPCIONES_SHEET_NAME — nombre de hoja (por defecto "Inscripciones Equipos").
 *
 * Si falta el ID, validarUsuario devuelve KO para claves de equipo (sin lanzar al cliente).
 */

function obtener_hjInscripcionesEquipos() {
  var props = PropertiesService.getScriptProperties()
  var spreadsheetId = props.getProperty('ETR7_INSCRIPCIONES_SPREADSHEET_ID')
  if (!spreadsheetId) {
    throw new Error('ETR7_INSCRIPCIONES_SPREADSHEET_ID no configurada')
  }
  var sheetName = props.getProperty('ETR7_INSCRIPCIONES_SHEET_NAME') || 'Inscripciones Equipos'
  var ss = SpreadsheetApp.openById(spreadsheetId)
  var sheet = ss.getSheetByName(sheetName)
  if (!sheet) {
    throw new Error('No se encontró la hoja: ' + sheetName)
  }
  return sheet
}
