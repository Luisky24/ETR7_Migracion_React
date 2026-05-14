/**
 * Normaliza categoría a "M" o "F".
 * Implementación: {@link ETR7_Shared_Infrastructure.normalizarCategoria} (source of truth en `ETR7_Shared_Backend/`).
 */
function normalizarCategoria(cat) {
  return ETR7_Shared_Infrastructure.normalizarCategoria(cat);
}

/**
 * Normaliza fase a "F1" o "F2".
 * Implementación: {@link ETR7_Shared_Infrastructure.normalizarFase} (source of truth en `ETR7_Shared_Backend/`).
 */
function normalizarFase(fase) {
  return ETR7_Shared_Infrastructure.normalizarFase(fase);
}

/**
 * Diagnóstico cuando no se encuentra una carpeta en Drive.
 * Registra en Logger y console para facilitar la depuración.
 * @param {string} tipo - "Competicion" | "Fase" | "Carpeta"
 * @param {string} rutaEsperada - Nombre o ruta esperada (ej: "Competicion_M", "Competicion_M/Fase1_M")
 * @param {string|null} carpetaPadreId - ID de la carpeta padre (solo para tipo "Fase")
 */
function diagnosticarRutaDrive(tipo, rutaEsperada, carpetaPadreId) {
  var msg = "[Drive] Carpeta no encontrada: " + rutaEsperada;
  if (tipo === "Fase" && carpetaPadreId) {
    msg += " (carpeta padre ID: " + carpetaPadreId + ")";
  }
  msg += ". Estructura esperada: Competicion_M/F, Fase1_M/F, Fase2_M/F.";
  Logger.log(msg);
  console.error(msg);
}

/**
 * Obtiene la carpeta de fase dentro de la carpeta raíz de competición.
 *
 * Convención única (estructura real en Drive):
 * Competicion_[M/F] / Fase1_[M/F] | Fase2_[M/F]
 *
 * @param {string} categoria - "M"|"F"|"Masculina"|"Femenina"|...
 * @param {string} fase - "Fase I"|"Fase II"|"Fase1"|"Fase2"|...
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function obtenerCarpetaCompeticion(categoria, fase) {
  if (!categoria || !fase) {
    throw new Error(
      "[Drive] categoria o fase indefinida -> categoria=" +
        categoria +
        " fase=" +
        fase,
    );
  }

  // Normalizar entradas (la SPA suele enviar "Masculina"/"Femenina")
  var catNorm = normalizarCategoria(categoria); // "M" | "F"
  var sufijo = (catNorm === "F") ? "F" : "M";

  var nombreCompeticion = "Competicion_" + sufijo;

  var nombreFase;

  // Aceptar variantes (Fase I / Fase1 / F1 / etc)
  var faseNorm = normalizarFase(fase); // "F1" | "F2"
  if (faseNorm === "F1") {
    nombreFase = "Fase1_" + sufijo;
  } else if (faseNorm === "F2") {
    nombreFase = "Fase2_" + sufijo;
  } else {
    throw new Error("[Drive] Fase no válida: " + fase);
  }

  // Cache de folderId (transversal) para evitar búsquedas repetidas en Drive.
  // Nota: DriveApp.getFoldersByName es caro; con cache reducimos mucho latencia.
  var cacheKey = "FOLDER_COMPETICION_V1::" + sufijo + "::" + faseNorm; // ej. M/F + F1/F2
  var cache = CacheService.getScriptCache();
  var cachedId = null;
  try { cachedId = cache.get(cacheKey); } catch (e0) { cachedId = null; }
  if (cachedId) {
    try { return DriveApp.getFolderById(cachedId); } catch (eId) { /* cache stale, continuar */ }
  }
  // Persistencia suave en ScriptProperties (por si el CacheService expulsa entradas)
  var props = PropertiesService.getScriptProperties();
  var propId = props.getProperty(cacheKey);
  if (propId) {
    try {
      var folder = DriveApp.getFolderById(propId);
      try { cache.put(cacheKey, propId, 21600); } catch (ePut1) {} // 6h
      return folder;
    } catch (eId2) {
      // stale: continuar a búsqueda por nombre
    }
  }

  // Log de depuración apagado por defecto (evita spam en ejecuciones normales)
  var DRIVE_DEBUG = false;
  if (DRIVE_DEBUG) Logger.log("Buscando carpeta: " + nombreCompeticion + "/" + nombreFase);

  var carpetaCompeticion = DriveApp.getFoldersByName(nombreCompeticion);

  if (!carpetaCompeticion.hasNext()) {
    throw new Error("[Drive] No existe carpeta: " + nombreCompeticion);
  }

  var comp = carpetaCompeticion.next();

  var carpetaFase = comp.getFoldersByName(nombreFase);

  if (!carpetaFase.hasNext()) {
    throw new Error("[Drive] No existe carpeta fase: " + nombreFase);
  }

  var out = carpetaFase.next();
  var outId = out.getId();
  try { cache.put(cacheKey, outId, 21600); } catch (ePut2) {}
  try { props.setProperty(cacheKey, outId); } catch (ePut3) {}
  return out;
}

/**
 * Invalida la caché (CacheService + ScriptProperties) de resolución de carpeta de competición.
 * Útil cuando una key quedó apuntando a una carpeta equivocada (p.ej. DES vs PRO).
 *
 * @param {string} categoria - "M"|"F"|"Masculina"|"Femenina"|...
 * @param {string} fase - "Fase I"|"Fase II"|"F1"|"F2"|...
 */
function invalidateCarpetaCompeticionCache(categoria, fase) {
  try {
    var catNorm = normalizarCategoria(categoria); // "M" | "F"
    var sufijo = catNorm === "F" ? "F" : "M";
    var faseNorm = normalizarFase(fase); // "F1" | "F2"
    var cacheKey = "FOLDER_COMPETICION_V1::" + sufijo + "::" + faseNorm;

    try {
      var cache = CacheService.getScriptCache();
      if (cache && typeof cache.remove === "function") cache.remove(cacheKey);
    } catch (eC) {}
    try {
      var props = PropertiesService.getScriptProperties();
      if (props && typeof props.deleteProperty === "function")
        props.deleteProperty(cacheKey);
    } catch (eP) {}

    try {
      Logger.log(
        "[Drive][invalidateCarpetaCompeticionCache] key=" +
          cacheKey +
          " categoria=" +
          String(categoria) +
          " fase=" +
          String(fase),
      );
    } catch (eL) {}
  } catch (e) {
    // best-effort: no bloquear el flujo si falla la invalidación
  }
}
