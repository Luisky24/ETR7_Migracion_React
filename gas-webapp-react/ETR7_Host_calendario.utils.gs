/**
 * Utilidades puras del dominio calendario: normalización de texto, resolución de
 * índices de cabecera y helpers sin efectos secundarios (I/O) compartidos por el resto
 * del módulo.
 *
 * Módulo modularizado: fuente de verdad de utilidades compartidas en este archivo.
 *
 * Incluye:
 * - _cal_normTxt_(s)
 * - _cal_idxHead_(header, aliases)
 * - Caché en memoria por ejecución (Drive / Spreadsheet / Sheet)
 * - Cabeceras normalizadas por hoja (`__cacheHeaders`, `getHeaderMapCached`, `getIndicesColumnaPorCabeceraCached`)
 * - Matriz de datos Calendario por ejecución (`__cacheData`, `getCalendarioData`)
 * - Caché persistente en Drive (`CacheCalendario`, `loadCalendarioCache` / `saveCalendarioCache`)
 */

/** @type {Object<string, Object<string, number[]>>} */
var __cacheHeaders = {};

/** @type {{ calendario: Object }} */
var __cacheData = {
  calendario: {},
};

/** Si true, no se usa carga/guardado en Drive (hubo escritura en Calendario en esta ejecución). */
var __calendarioDriveCacheDisabled = false;

/** @type {{ carpetas: Object, libros: Object, hojas: Object }} */
var __cacheInfra = {
  carpetas: {},
  libros: {},
  hojas: {},
};

/**
 * Carpeta de competición por categoría y fase (misma lógica que obtenerCarpetaCompeticion).
 * Clave interna: categoria|fase
 */
function getCarpetaCached(categoria, fase) {
  var key = String(categoria || "") + "|" + String(fase || "");
  if (key in __cacheInfra.carpetas) {
    return __cacheInfra.carpetas[key];
  }
  var carpeta = obtenerCarpetaCompeticion(categoria, fase);
  __cacheInfra.carpetas[key] = carpeta;
  return carpeta;
}

/**
 * ID de libro bajo una carpeta. En `libros` la clave es carpetaId|nombreLibro (string);
 * las claves sin "|" reservan instancias Spreadsheet devueltas por getSpreadsheetCached.
 */
function getLibroIdCached(carpetaId, nombreLibro) {
  var key = String(carpetaId) + "|" + String(nombreLibro || "");
  if (key in __cacheInfra.libros) {
    var prev = __cacheInfra.libros[key];
    if (typeof prev !== "object" || prev === null) {
      return prev;
    }
  }
  var id = obtener_ID_Libro_x_ID_Carpeta(carpetaId, nombreLibro);
  __cacheInfra.libros[key] = id;
  return id;
}

function getSpreadsheetCached(id) {
  var sid = String(id || "");
  if (!sid) {
    throw new Error("getSpreadsheetCached: id vacío");
  }
  var cached = __cacheInfra.libros[sid];
  if (cached && typeof cached === "object") {
    return cached;
  }
  var ss = SpreadsheetApp.openById(sid);
  __cacheInfra.libros[sid] = ss;
  return ss;
}

function getSheetCached(ssId, nombreHoja) {
  var key = String(ssId) + "|" + String(nombreHoja || "");
  if (key in __cacheInfra.hojas) {
    return __cacheInfra.hojas[key];
  }
  var ss = getSpreadsheetCached(ssId);
  var hoja = ss.getSheetByName(nombreHoja);
  __cacheInfra.hojas[key] = hoja;
  return hoja;
}

/**
 * Mapa cabecera normalizada (`hojaNormalizarNombreCabeceraCal_`) → índices 0-based de columna.
 * Misma regla que {@link hojaIndicesColumnasPorCabeceraNormalizada} / {@link hojaNormalizarNombreCabeceraCal_}.
 */
function getHeaderMapCached(hoja) {
  if (!hoja) return {};
  var key = hoja.getParent().getId() + "|" + hoja.getName();
  if (__cacheHeaders[key]) {
    return __cacheHeaders[key];
  }
  var lastCol = hoja.getLastColumn();
  if (lastCol < 1) {
    __cacheHeaders[key] = {};
    return __cacheHeaders[key];
  }
  var header = hoja.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
  var map = {};
  for (var i = 0; i < header.length; i++) {
    var h = hojaNormalizarNombreCabeceraCal_(header[i]);
    if (!h) continue;
    if (!map[h]) map[h] = [];
    map[h].push(i);
  }
  __cacheHeaders[key] = map;
  return map;
}

/**
 * Equivalente a {@link hojaIndicesColumnasPorCabeceraNormalizada} usando caché de cabeceras.
 */
function getIndicesColumnaPorCabeceraCached(hoja, nombreClave) {
  if (!hoja) return [];
  var map = getHeaderMapCached(hoja);
  var want = hojaNormalizarNombreCabeceraCal_(nombreClave);
  var arr = map[want];
  return arr ? arr.slice() : [];
}

/**
 * Carpeta de caché persistente en Drive (se crea si no existe).
 */
function getCacheFolder() {
  var it = DriveApp.getFoldersByName("CacheCalendario");
  if (it.hasNext()) return it.next();
  return DriveApp.getRootFolder().createFolder("CacheCalendario");
}

/**
 * Clave de versión barata: dimensiones de la hoja (cambian al añadir filas/columnas).
 */
function getCalendarioVersion(hoja) {
  if (!hoja) return "0|0";
  return hoja.getLastRow() + "|" + hoja.getLastColumn();
}

function _calendarioPersistKeyToFileName_(persistKey) {
  return "CAL_" + String(persistKey || "").replace(/[/\\?*:[\]]/g, "_") + ".json";
}

function saveCalendarioCache(persistKey, data) {
  try {
    var folder = getCacheFolder();
    var fileName = _calendarioPersistKeyToFileName_(persistKey);
    var content = JSON.stringify(data);
    var files = folder.getFilesByName(fileName);
    if (files.hasNext()) {
      var file = files.next();
      file.setContent(content);
    } else {
      folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
    }
  } catch (eSave) {}
}

function loadCalendarioCache(persistKey) {
  try {
    var folder = getCacheFolder();
    var fileName = _calendarioPersistKeyToFileName_(persistKey);
    var files = folder.getFilesByName(fileName);
    if (!files.hasNext()) return null;
    var content = files.next().getBlob().getDataAsString();
    return JSON.parse(content);
  } catch (eLoad) {
    return null;
  }
}

/**
 * Filas de datos de la hoja Calendario (desde fila 2), getDisplayValues — misma semántica que las lecturas previas.
 * Claves: `categoria|faseNorm` (F1|F2) y `spreadsheetId|nombreHoja` (alias al mismo array).
 * Tras modificar la hoja, usar {@link invalidateCalendarioDataCacheForHoja}.
 */
function getCalendarioData(categoria, fase) {
  var faseNorm = normalizarFase(fase);
  var key = String(categoria || "") + "|" + String(faseNorm || "");
  if (key in __cacheData.calendario) {
    return __cacheData.calendario[key];
  }
  var carpeta = getCarpetaCached(categoria, fase);
  var nombreLibro = faseNorm === "F2" ? "Calendario_Fase2" : "Calendario_Fase1";
  var libroId = getLibroIdCached(carpeta.getId(), nombreLibro);
  if (!libroId) {
    __cacheData.calendario[key] = [];
    return [];
  }
  var hoja = getSheetCached(libroId, "Calendario");
  if (!hoja) {
    __cacheData.calendario[key] = [];
    return [];
  }
  var sk = hoja.getParent().getId() + "|" + hoja.getName();
  if (sk in __cacheData.calendario) {
    __cacheData.calendario[key] = __cacheData.calendario[sk];
    return __cacheData.calendario[key];
  }
  var lastRow = hoja.getLastRow();
  var lastCol = hoja.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    __cacheData.calendario[key] = [];
    __cacheData.calendario[sk] = [];
    return [];
  }
  var version = getCalendarioVersion(hoja);
  var persistKey = key + "|" + version;
  if (!__calendarioDriveCacheDisabled) {
    var cached = loadCalendarioCache(persistKey);
    if (cached) {
      __cacheData.calendario[key] = cached;
      __cacheData.calendario[sk] = cached;
      return cached;
    }
  }
  var data = hoja.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  __cacheData.calendario[key] = data;
  __cacheData.calendario[sk] = data;
  if (!__calendarioDriveCacheDisabled) {
    saveCalendarioCache(persistKey, data);
  }
  return data;
}

/**
 * Misma caché que {@link getCalendarioData} cuando solo se tiene la hoja (p. ej. búsqueda por encuentro).
 */
function getCalendarioDataForHoja(hoja) {
  if (!hoja) return [];
  var sk = hoja.getParent().getId() + "|" + hoja.getName();
  if (sk in __cacheData.calendario) {
    return __cacheData.calendario[sk];
  }
  var lastRow = hoja.getLastRow();
  var lastCol = hoja.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    __cacheData.calendario[sk] = [];
    return [];
  }
  var version = getCalendarioVersion(hoja);
  var persistKey = sk + "|" + version;
  if (!__calendarioDriveCacheDisabled) {
    var cachedH = loadCalendarioCache(persistKey);
    if (cachedH) {
      __cacheData.calendario[sk] = cachedH;
      return cachedH;
    }
  }
  var data = hoja.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  __cacheData.calendario[sk] = data;
  if (!__calendarioDriveCacheDisabled) {
    saveCalendarioCache(persistKey, data);
  }
  return data;
}

/**
 * Invalida entradas de caché que apuntan a la matriz de esta hoja (tras escrituras).
 */
function invalidateCalendarioDataCacheForHoja(hoja) {
  __calendarioDriveCacheDisabled = true;
  if (!hoja) return;
  var sk = hoja.getParent().getId() + "|" + hoja.getName();
  var data = __cacheData.calendario[sk];
  delete __cacheData.calendario[sk];
  if (!data) return;
  for (var k in __cacheData.calendario) {
    if (
      Object.prototype.hasOwnProperty.call(__cacheData.calendario, k) &&
      __cacheData.calendario[k] === data
    ) {
      delete __cacheData.calendario[k];
    }
  }
}

function _cal_normTxt_(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function _cal_idxHead_(header, aliases) {
  var headLow = (header || []).map(function (h) {
    return _cal_normTxt_(h);
  });
  for (var a = 0; a < aliases.length; a++) {
    var al = _cal_normTxt_(aliases[a]);
    for (var i = 0; i < headLow.length; i++) {
      var h = headLow[i];
      if (h === al || h.indexOf(al) >= 0) return i;
    }
  }
  return -1;
}
