/**
 * Lectura `obtenerDatosInformacion` para el boundary calendario v2 en el host React
 * (copiado de `ETRugby7/calendario/calendario.service.gs`, solo la función de lectura).
 *
 * @fileoverview Host React — datos Calendario sin biblioteca GAS de competición.
 */

function obtenerDatosInformacion(
  categoria = "Masculina",
  fase = "Fase I",
  subpestania = "Calendario",
) {
  // Cache para acelerar carga inicial del Calendario (TTL corto).
  try {
    var cache = CacheService.getScriptCache();
    var key =
      "CAL_V3|" +
      String(categoria) +
      "|" +
      String(fase) +
      "|" +
      String(subpestania);
    var cached = cache.get(key);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        if (
          parsed &&
          typeof parsed === "object" &&
          parsed.version === 2 &&
          Array.isArray(parsed.filas)
        ) {
          return parsed;
        }
        if (Array.isArray(parsed)) {
          return { version: 2, filas: parsed };
        }
      } catch (eJson) {}
    }
  } catch (eCache) {}

  let hoja = [];

  if (![categoria, fase, subpestania].every(Boolean)) {
    console.error("Error: Parámetros inválidos.");
    console.log(
      `Categoria: ${categoria}, Fase: ${fase}, Subpestaña: ${subpestania}`,
    );
    return null;
  }

  function wrapCalV2_(rows) {
    return { version: 2, filas: Array.isArray(rows) ? rows : [] };
  }

  if (fase === "Fase I" && subpestania === "Calendario") {
    let carpetaFase = getCarpetaCached(categoria, fase);
    let libroID = getLibroIdCached(
      carpetaFase.getId(),
      "Calendario_Fase1",
    );
    hoja = getSheetCached(libroID, "Calendario");
    var out1 = wrapCalV2_(formatearCalendarioF1(hoja));
    try {
      CacheService.getScriptCache().put(key, JSON.stringify(out1), 60);
    } catch (ePut1) {}
    return out1;
  } else if (fase === "Fase II" && subpestania === "Calendario") {
    // Hotfix: en PRO, evitar resolver carpeta equivocada por caché persistente (DES/PRO).
    // __HOTFIX_F2_INVALIDATE_FOLDER_CACHE__ (REMOVE ME)
    try {
      var catNorm = normalizarCategoria(categoria); // "M" | "F"
      if (catNorm === "M" && typeof invalidateCarpetaCompeticionCache === "function") {
        // 1) Invalidar caché de carpeta (Properties + CacheService)
        invalidateCarpetaCompeticionCache(categoria, fase);
        // 2) Invalidar caché en memoria de calendario.utils (si existe)
        try {
          if (typeof __cacheInfra !== "undefined" && __cacheInfra && __cacheInfra.carpetas) {
            delete __cacheInfra.carpetas[String(categoria) + "|" + String(fase)];
          }
        } catch (eMem) {}
        // 3) Invalidar caché de respuesta CAL_V3 (por si venía de carpeta errónea)
        try {
          var c0 = CacheService.getScriptCache();
          if (c0 && typeof c0.remove === "function") c0.remove(key);
        } catch (eRm) {}
      }
    } catch (eInv) {}

    // Sanity check: si la carpeta resuelta no contiene Calendario_Fase2, limpiar caché y reintentar 1 vez.
    // __HOTFIX_F2_INVALIDATE_FOLDER_CACHE__ (REMOVE ME)
    var carpetaFase = null;
    var libroID = null;
    for (var attempt = 1; attempt <= 2; attempt++) {
      carpetaFase = getCarpetaCached(categoria, fase);
      if (!carpetaFase) break;
      libroID = getLibroIdCached(carpetaFase.getId(), "Calendario_Fase2");
      if (libroID) break;
      try {
        Logger.log(
          "[Calendario][sanity] Calendario_Fase2 no encontrado en carpeta fase (attempt=" +
            attempt +
            "). Invalidando caché y reintentando.",
        );
      } catch (eLog) {}
      try {
        if (typeof invalidateCarpetaCompeticionCache === "function") {
          invalidateCarpetaCompeticionCache(categoria, fase);
        }
      } catch (eInv2) {}
      try {
        if (typeof __cacheInfra !== "undefined" && __cacheInfra && __cacheInfra.carpetas) {
          delete __cacheInfra.carpetas[String(categoria) + "|" + String(fase)];
        }
      } catch (eMem2) {}
    }

    hoja = getSheetCached(libroID, "Calendario");
    var out2 = wrapCalV2_(formatearCalendarioF1(hoja));
    try {
      CacheService.getScriptCache().put(key, JSON.stringify(out2), 60);
    } catch (ePut2) {}
    return out2;
  }

  if (!hoja) {
    console.error("Error: No se pudo obtener la hoja.");
    return [];
  }

  return datosCalendario;
}
