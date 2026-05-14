/**
 * Host mínimo HtmlService para la SPA React (ETR7).
 * Sin lógica de negocio ni router legacy: solo evalúa plantilla e inyecta assets generados.
 */

/**
 * @param {string} filename Nombre de archivo HTML del proyecto (sin extensión), p. ej. "Assets_js".
 * @return {string}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent()
}

function doGet() {
  return HtmlService.createTemplateFromFile('ReactHost')
    .evaluate()
    .setTitle('ETR7')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

/**
 * Alias QA manual en el IDE (Run). Equivale a {@link etr7_runtime_selfcheck_v1}.
 * @return {Object}
 */
function test_selfcheck() {
  const result = etr7_runtime_selfcheck_v1();

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}
