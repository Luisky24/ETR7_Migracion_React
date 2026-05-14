/**
 * Lectura libro equipo + ENC (sin obtenerAlineacionesEstado).
 * Copia de `ETRugby7/02_alineacionesReader.js` (host React).
 *
 * @fileoverview ETR7_Host — readers alineación SPA.
 */

function _tryLeerAlineacionEncuentroSoloLibroEquipo_(catBackend, faseBackend, enc, equipo) {
  try {
    if (!enc || equipo == null || String(equipo).trim() === "") return null;
    var local = enc[1] != null ? String(enc[1]).trim() : "";
    var visitante = enc[2] != null ? String(enc[2]).trim() : "";
    var grupoKey = enc[0] != null ? String(enc[0]).trim() : "";
    var carpetaFase = obtenerCarpetaCompeticion(catBackend, faseBackend);
    var cid = carpetaFase.getId();
    var equipoTrim = String(equipo).trim();
    var libroID = obtener_ID_Libro_x_ID_Carpeta(cid, equipoTrim);
    if (!libroID) {
      _logAlineacionesIO_("LEER SPA solo libro equipo — sin archivo libro", {
        equipo: equipoTrim,
        carpetaFaseId: cid,
      });
      return null;
    }
    var libroOpen = SpreadsheetApp.openById(libroID);
    var idEncuentro = grupoKey + "|" + local + "|" + visitante;
    var suffixPartido = _host_suffixPartidoExacto_(local, visitante);
    var dbg = _host_encLineupsV2DebugEnabled_();
    if (dbg) {
      try {
        Logger.log(
          "[ETR7_Host_alineacionesReader] DEBUG PASO1 partido buscado suffix=\"" +
            suffixPartido +
            "\" libroId=" +
            libroID +
            " idEnc=" +
            idEncuentro,
        );
      } catch (eDbg0) {}
    }

    var hojaAlineacion = null;
    var exactList = _host_collectEncSheetsExactPartido_(libroOpen, suffixPartido);
    if (exactList.length > 1 && dbg) {
      try {
        var names = [];
        for (var wi = 0; wi < exactList.length; wi++) {
          names.push(exactList[wi].name);
        }
        Logger.log(
          "[ETR7_Host_alineacionesReader] DEBUG varias ENC exactas (" +
            exactList.length +
            "): " +
            names.join(" | "),
        );
      } catch (eDbg1) {}
    }
    if (exactList.length >= 1) {
      hojaAlineacion = exactList[0].sheet;
      if (dbg) {
        try {
          Logger.log(
            "[ETR7_Host_alineacionesReader] DEBUG coincidencia exacta hoja=\"" +
              exactList[0].name +
              "\"",
          );
        } catch (eDbg2) {}
      }
      _setAlineacionSheetIndex_(libroID, idEncuentro, hojaAlineacion.getName());
    }

    if (!hojaAlineacion) {
      hojaAlineacion = _getAlineacionSheetFromIndex_(libroOpen, libroID, idEncuentro);
      if (hojaAlineacion) {
        var prIdx = _host_parseOrdAndRestFromEncSheetName_(hojaAlineacion.getName());
        if (!prIdx || prIdx.rest !== suffixPartido) {
          if (dbg) {
            try {
              Logger.log(
                "[ETR7_Host_alineacionesReader] DEBUG indice ignorado (no coincide suffix): \"" +
                  hojaAlineacion.getName() +
                  "\"",
              );
            } catch (eDbg3) {}
          }
          hojaAlineacion = null;
        } else if (dbg) {
          try {
            Logger.log(
              "[ETR7_Host_alineacionesReader] DEBUG hoja via indice validada: \"" +
                hojaAlineacion.getName() +
                "\"",
            );
          } catch (eDbg4) {}
        }
      }
    }

    if (!hojaAlineacion) {
      if (dbg) {
        try {
          Logger.log(
            "[ETR7_Host_alineacionesReader] DEBUG sin ENC exacta ni indice valido; delegar a ENC reciente / plantilla",
          );
        } catch (eDbg5) {}
      }
      _logAlineacionesIO_("LEER SPA solo libro equipo — sin hoja ENC para encuentro", {
        libroId: libroID,
        equipo: equipoTrim,
        idEncuentro: idEncuentro,
        suffixPartido: suffixPartido,
      });
      return null;
    }
    if (typeof obtenerEstrucAlineacion !== "function") {
      _logAlineacionesIO_("LEER SPA solo libro equipo — obtenerEstrucAlineacion no disponible", {});
      return null;
    }
    var modelo = obtenerEstrucAlineacion(hojaAlineacion);
    _logAlineacionesIO_("LEER SPA solo libro equipo — modelo leído", {
      libroId: libroID,
      hojaNombre: hojaAlineacion.getName(),
      modeloEquipo: modelo && modelo.equipo != null ? String(modelo.equipo).trim() : "",
    });
    return modelo;
  } catch (e) {
    _logAlineacionesIO_("LEER SPA solo libro equipo — excepción", {
      mensaje: e && e.message ? e.message : String(e),
    });
    return null;
  }
}

function _alineaciones_parseEncOrdinal_(sheetName) {
  try {
    var pr = _host_parseOrdAndRestFromEncSheetName_(sheetName);
    return pr ? pr.ord : null;
  } catch (e) {
    return null;
  }
}

function _alineaciones_modeloEsCompleto_(modelo) {
  try {
    if (!modelo) return false;
    var j = modelo.jugadores;
    if (!Array.isArray(j) || !j.length) return false;
    for (var i = 0; i < j.length; i++) {
      var nombre = j[i] && j[i][0] != null ? String(j[i][0]).trim() : "";
      if (nombre) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function _tryLeerUltimaAlineacionCompletaPorENC_(catBackend, faseBackend, equipo) {
  try {
    var equipoTrim = String(equipo || "").trim();
    if (!equipoTrim) return null;
    var carpetaFase = obtenerCarpetaCompeticion(catBackend, faseBackend);
    var cid = carpetaFase.getId();
    var libroID = obtener_ID_Libro_x_ID_Carpeta(cid, equipoTrim);
    if (!libroID) return null;
    if (typeof obtenerEstrucAlineacion !== "function") return null;

    var dbg = _host_encLineupsV2DebugEnabled_();
    if (dbg) {
      try {
        Logger.log(
          "[ETR7_Host_alineacionesReader] DEBUG PASO2 fallback ENC mas reciente (ordinal max) libroId=" +
            libroID +
            " equipo=" +
            equipoTrim,
        );
      } catch (eDbgU0) {}
    }

    var libroOpen = SpreadsheetApp.openById(libroID);
    var sheets = libroOpen.getSheets();
    var encs = [];
    for (var i = 0; i < sheets.length; i++) {
      var n = sheets[i].getName();
      if (String(n).indexOf("ENC_") !== 0) continue;
      var pr = _host_parseOrdAndRestFromEncSheetName_(n);
      if (!pr) continue;
      encs.push({ ord: pr.ord, sheet: sheets[i], name: n });
    }
    encs.sort(function (a, b) {
      return b.ord - a.ord;
    });
    for (var j = 0; j < encs.length; j++) {
      try {
        var sh = encs[j].sheet;
        var modelo = obtenerEstrucAlineacion(sh);
        if (_alineaciones_modeloEsCompleto_(modelo)) {
          if (dbg) {
            try {
              Logger.log(
                "[ETR7_Host_alineacionesReader] DEBUG PASO2 usando hoja=\"" +
                  encs[j].name +
                  "\" ord=" +
                  encs[j].ord,
              );
            } catch (eDbgU1) {}
          }
          _logAlineacionesIO_("LEER SPA última ENC completa — usada", {
            libroId: libroID,
            hojaNombre: encs[j].name,
            ord: encs[j].ord,
          });
          return modelo;
        }
        _logAlineacionesIO_("LEER SPA última ENC completa — descartada (incompleta)", {
          hojaNombre: encs[j].name,
          ord: encs[j].ord,
        });
      } catch (eOne) {}
    }
    if (dbg) {
      try {
        Logger.log(
          "[ETR7_Host_alineacionesReader] DEBUG PASO2 sin ENC completa utilizable; delegar plantilla/inscritos",
        );
      } catch (eDbgU2) {}
    }
    return null;
  } catch (e) {
    _logAlineacionesIO_("LEER SPA última ENC completa — excepción", {
      mensaje: e && e.message ? e.message : String(e),
    });
    return null;
  }
}
