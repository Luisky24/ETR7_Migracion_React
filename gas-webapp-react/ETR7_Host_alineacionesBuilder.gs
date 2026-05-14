/**
 * API SPA: modelo alineación por equipo (libro fase + ENC + plantilla inscripciones).
 * Copia de `ETRugby7/03_alineacionesBuilder.js` (host React autónomo).
 *
 * @fileoverview ETR7_Host — obtenerModeloAlineacionCompletoSPA + obtenerListaJugadoresInscritos.
 */

function obtenerListaJugadoresInscritos(categoria, equipoAlineac) {
  var cat = String(categoria || "").trim().toUpperCase() === "F" ? "F" : "M";
  var eq = String(equipoAlineac || "").trim();
  var directorio = "Competicion_" + cat;
  var libroEquipo = eq + "_" + cat;
  var nombreHojaInsc = cat === "F" ? "Femenino" : "Masculino";

  var carpetaIdLog = null;
  var libroIdLog = null;
  try {
    var cm = obtenerIDyURLCarpeta(directorio);
    if (cm && cm[0]) {
      carpetaIdLog = cm[0];
      libroIdLog = obtener_ID_Libro_x_ID_Carpeta(carpetaIdLog, libroEquipo);
    }
  } catch (eIds) {}

  _logAlineacionesIO_("LEER inscripciones (plantilla alineación)", {
    carpetaNombre: directorio,
    carpetaId: carpetaIdLog,
    libroNombre: libroEquipo,
    libroId: libroIdLog || null,
    hojaNombre: nombreHojaInsc,
  });

  var hojaInscripcionesEquipo = obtenerHoja(directorio, libroEquipo, nombreHojaInsc);
  _logAlineacionesIO_("LEER inscripciones — resultado", {
    carpetaNombre: directorio,
    libroNombre: libroEquipo,
    hojaNombre: nombreHojaInsc,
    hojaEncontrada: !!hojaInscripcionesEquipo,
  });
  if (!hojaInscripcionesEquipo) return [];

  var listaJugadoresInscritos = hojaInscripcionesEquipo
    .getRange(1, 1, hojaInscripcionesEquipo.getLastRow(), 1)
    .getValues()
    .flat();

  return listaJugadoresInscritos.map(function (jugador) {
    return [jugador, "", "", "", 0];
  });
}

function _estadoAlineacionDesdeEnc6_(enc, indLocalVisitante) {
  var estadoAli = enc && enc[6] ? String(enc[6]) : "";
  var partes = estadoAli.split("-");
  var token = indLocalVisitante === "V" ? partes[1] : partes[0];
  return (token || "").trim().toUpperCase() || "P";
}

/**
 * @param {{categoria:string,fase:string,encuentro:Array,equipo:string}} payload
 * @returns {{ok:boolean, origen:string, modelo:Object|null, error?:{mensaje:string}}}
 */
function obtenerModeloAlineacionCompletoSPA(payload) {
  try {
    if (!payload || !payload.encuentro || !payload.equipo) {
      _logAlineacionesIO_("LEER SPA obtenerModelo — payload incompleto", {
        tieneEncuentro: !!(payload && payload.encuentro),
        tieneEquipo: !!(payload && payload.equipo),
      });
      return {
        ok: false,
        origen: "error",
        modelo: null,
        error: { mensaje: "Payload incompleto" },
      };
    }

    var equipo = String(payload.equipo || "").trim();
    var enc = payload.encuentro;
    var local = enc && enc[1] != null ? String(enc[1]).trim() : "";
    var visitante = enc && enc[2] != null ? String(enc[2]).trim() : "";

    var catIn = String(payload.categoria || "M").trim();
    var faseIn = String(payload.fase || "Fase I").trim();
    var catBackend =
      catIn === "F" || catIn.toLowerCase() === "femenina" ? "Femenina" : "Masculina";
    var faseBackend =
      faseIn === "Fase2" ||
      faseIn === "Fase II" ||
      faseIn.toLowerCase() === "fase ii"
        ? "Fase2"
        : "Fase1";

    var rutaFaseLog = _rutaLogicaCarpetaFase_(catBackend, faseBackend);
    _logAlineacionesIO_("LEER SPA obtenerModelo — inicio", {
      rutaCarpetaFase: rutaFaseLog,
      equipoSolicitado: equipo,
      encuentroCalendario: local + " - " + visitante,
      grupo: enc && enc[0] != null ? String(enc[0]) : "",
      nota: "Diagnóstico Drive; solo libro del equipo; ENC_* + obtenerEstrucAlineacion; si no hay → plantilla",
    });

    _logDiagnosticosDriveEncuentroSPA_(catBackend, faseBackend, enc, equipo);

    var modeloExistente = _tryLeerAlineacionEncuentroSoloLibroEquipo_(
      catBackend,
      faseBackend,
      enc,
      equipo,
    );
    if (modeloExistente) {
      modeloExistente.referencia_encuentro =
        enc && enc[8] != null ? String(enc[8]).trim() : "";
      modeloExistente.estado = _estadoAlineacionDesdeEnc6_(
        enc,
        modeloExistente.indLocalVisitante,
      );
      _logAlineacionesIO_("LEER SPA obtenerModelo — existente (solo libro equipo)", {
        rutaCarpetaFase: rutaFaseLog,
        libroEquipoSolicitado: equipo,
        modeloEncuentro:
          modeloExistente.encuentro != null ? String(modeloExistente.encuentro) : "",
        modeloEquipoCampo:
          modeloExistente.equipo != null ? String(modeloExistente.equipo) : "",
        origenBackend: "libroEquipo_ENC_obtenerEstrucAlineacion",
      });
      return JSON.parse(
        JSON.stringify({
          ok: true,
          origen: "existente",
          modelo: modeloExistente,
        }),
      );
    }

    var modeloPrevio = _tryLeerUltimaAlineacionCompletaPorENC_(catBackend, faseBackend, equipo);
    if (modeloPrevio) {
      var indLocalVisitantePrev =
        equipo === local ? "L" : equipo === visitante ? "V" : "";
      var contrarioPrev =
        indLocalVisitantePrev === "L"
          ? visitante
          : indLocalVisitantePrev === "V"
            ? local
            : "";

      var modeloClonado = JSON.parse(JSON.stringify(modeloPrevio));
      modeloClonado.numFilaCalendario = null;
      modeloClonado.categoria = payload.categoria === "F" ? "F" : "M";
      modeloClonado.equipo = equipo;
      modeloClonado.fase = payload.fase || "Fase I";
      modeloClonado.grupo = enc ? enc[0] : "";
      modeloClonado.contrario = contrarioPrev;
      modeloClonado.encuentro = local + " - " + visitante;
      modeloClonado.indLocalVisitante = indLocalVisitantePrev;
      modeloClonado.campo = enc ? enc[4] : "";
      modeloClonado.hora = enc ? enc[3] : "";
      modeloClonado.estado = _estadoAlineacionDesdeEnc6_(enc, indLocalVisitantePrev);
      modeloClonado.referencia_encuentro =
        enc && enc[8] != null ? String(enc[8]).trim() : "";

      _logAlineacionesIO_("LEER SPA obtenerModelo — previa usada", {
        rutaCarpetaFase: rutaFaseLog,
        equipo: equipo,
        numJugadores:
          modeloClonado && Array.isArray(modeloClonado.jugadores)
            ? modeloClonado.jugadores.length
            : 0,
        nota: "Copiados delegado/entrenador/jugadores (marcas+dorsales) desde última ENC_XX completa",
      });

      return JSON.parse(
        JSON.stringify({
          ok: true,
          origen: "previa",
          modelo: modeloClonado,
        }),
      );
    }

    _logAlineacionesIO_("LEER SPA obtenerModelo — plantilla (sin ENC en libro del equipo / sin libro)", {
      rutaCarpetaFase: rutaFaseLog,
      siguientePaso: "obtenerListaJugadoresInscritos en Competicion_[M|F]",
    });

    var catShort = catBackend === "Femenina" ? "F" : "M";
    var jugadores = [];
    try {
      if (typeof obtenerListaJugadoresInscritos === "function") {
        jugadores = obtenerListaJugadoresInscritos(catShort, equipo) || [];
      }
    } catch (e2) {
      jugadores = [];
    }

    var indLocalVisitante =
      equipo === local ? "L" : equipo === visitante ? "V" : "";
    var contrario =
      indLocalVisitante === "L"
        ? visitante
        : indLocalVisitante === "V"
          ? local
          : "";

    var modeloTpl = {
      numFilaCalendario: null,
      categoria: payload.categoria === "F" ? "F" : "M",
      equipo: equipo,
      fase: payload.fase || "Fase I",
      grupo: enc ? enc[0] : "",
      contrario: contrario,
      encuentro: local + " - " + visitante,
      indLocalVisitante: indLocalVisitante,
      campo: enc ? enc[4] : "",
      hora: enc ? enc[3] : "",
      estado: _estadoAlineacionDesdeEnc6_(enc, indLocalVisitante),
      referencia_encuentro: enc && enc[8] != null ? String(enc[8]).trim() : "",
      delegado: "",
      entrenador: "",
      jugadores: Array.isArray(jugadores) ? jugadores : [],
    };

    _logAlineacionesIO_("LEER SPA obtenerModelo — plantilla lista", {
      rutaCarpetaFase: rutaFaseLog,
      inscripcionesCarpeta: "Competicion_" + catShort,
      inscripcionesLibroHoja: equipo + "_" + catShort,
      numJugadores: Array.isArray(jugadores) ? jugadores.length : 0,
    });

    return JSON.parse(
      JSON.stringify({ ok: true, origen: "plantilla", modelo: modeloTpl }),
    );
  } catch (e) {
    _logAlineacionesIO_("LEER SPA obtenerModelo — excepción", {
      mensaje: e && e.message ? e.message : String(e),
    });
    return {
      ok: false,
      origen: "error",
      modelo: null,
      error: { mensaje: e && e.message ? e.message : String(e) },
    };
  }
}

/**
 * QA manual (Run en IDE). Esperado en registro: `function` para ambos.
 */
function test_alineaciones_runtime() {
  Logger.log(typeof obtenerModeloAlineacionCompletoSPA);
  Logger.log(typeof obtenerEstrucAlineacion);
  Logger.log(typeof _tryLeerAlineacionEncuentroSoloLibroEquipo_);
}
