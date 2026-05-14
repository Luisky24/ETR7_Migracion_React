/**
 * Logs [AlineacionesIO] y diagnóstico Drive SPA.
 * Copia de `ETRugby7/01_alineacionesLogger.js` (host React).
 *
 * @fileoverview ETR7_Host — trazas alineaciones SPA.
 */

function _logAlineacionesIO_(etiqueta, detalle) {
  try {
    var payload =
      detalle != null && typeof detalle === "object"
        ? JSON.stringify(detalle)
        : String(detalle);
    var line = "[AlineacionesIO] " + etiqueta + " " + payload;
    Logger.log(line);
    console.log(line);
  } catch (eLog) {}
}

function _rutaLogicaCarpetaFase_(catBackend, faseBackend) {
  try {
    var suf = normalizarCategoria(catBackend === "Femenina" ? "Femenina" : "Masculina");
    suf = suf === "F" ? "F" : "M";
    var fn = normalizarFase(faseBackend);
    var sub = fn === "F2" ? "Fase2_" + suf : "Fase1_" + suf;
    return "Competicion_" + suf + " / " + sub;
  } catch (e) {
    return "(ruta no calculada)";
  }
}

function _listarNombresHojasEncEnLibro_(libroId, maxN) {
  maxN = maxN || 30;
  if (!libroId) return [];
  try {
    var o = SpreadsheetApp.openById(libroId);
    var sheets = o.getSheets();
    var out = [];
    for (var i = 0; i < sheets.length && out.length < maxN; i++) {
      var n = sheets[i].getName();
      if (n.indexOf("ENC_") === 0) out.push(n);
    }
    return out;
  } catch (e) {
    return ["(error abriendo libro: " + (e && e.message ? e.message : e) + ")"];
  }
}

function _logDiagnosticosDriveEncuentroSPA_(catBackend, faseBackend, enc, equipo) {
  try {
    var local = enc && enc[1] != null ? String(enc[1]).trim() : "";
    var visitante = enc && enc[2] != null ? String(enc[2]).trim() : "";
    var grupo = enc && enc[0] != null ? String(enc[0]).trim() : "";
    var idEnc = grupo + "|" + local + "|" + visitante;
    var carpetaFase = obtenerCarpetaCompeticion(catBackend, faseBackend);
    var cid = carpetaFase.getId();
    var cname = carpetaFase.getName();
    var idLoc = obtener_ID_Libro_x_ID_Carpeta(cid, local);
    var idVis = obtener_ID_Libro_x_ID_Carpeta(cid, visitante);
    var idSol = obtener_ID_Libro_x_ID_Carpeta(cid, equipo);
    _logAlineacionesIO_("LEER SPA — Drive carpeta y libros (ENC_* por libro)", {
      rutaLogica: _rutaLogicaCarpetaFase_(catBackend, faseBackend),
      carpetaFaseNombre: cname,
      carpetaFaseId: cid,
      idEncuentro: idEnc,
      libroLocal: {
        nombreArchivoEsperado: local,
        libroId: idLoc || null,
        hojasENC: _listarNombresHojasEncEnLibro_(idLoc),
      },
      libroVisitante: {
        nombreArchivoEsperado: visitante,
        libroId: idVis || null,
        hojasENC: _listarNombresHojasEncEnLibro_(idVis),
      },
      libroEquipoSolicitado: {
        nombreArchivoEsperado: equipo,
        libroId: idSol || null,
        hojasENC: _listarNombresHojasEncEnLibro_(idSol),
      },
    });
  } catch (eD) {
    _logAlineacionesIO_("LEER SPA — error diagnóstico Drive", {
      mensaje: eD && eD.message ? eD.message : String(eD),
    });
  }
}
