/**
 * Host React — aplicación procedural de bundles Calendario ← Acta JSON.
 * Sin decisiones de negocio: solo ejecuta proyección TS (`CalendarSyncBundleWire`).
 *
 * @fileoverview ETR7_Host_calendarSync.gs
 */

var CALENDAR_SYNC_IDEM_PREFIX_ = "CAL_SYNC_IDEM::";
var CALENDAR_SYNC_IDEM_TTL_SEC_ = 604800;

/**
 * @param {Object} bundleWire
 * @return {Object}
 */
function calendarSync_applyBundle(bundleWire) {
  calendarSync_log_("apply.start", {
    syncKeyString: bundleWire && bundleWire.syncKeyString,
    intent: bundleWire && bundleWire.syncKey && bundleWire.syncKey.intent,
  });

  var shape = calendarSync_validateBundleShape_(bundleWire);
  if (!shape.ok) {
    calendarSync_log_("apply.invalid", { message: shape.message });
    return calendarSync_fail_(shape.code, shape.message, bundleWire);
  }

  var wire = shape.bundle;
  if (calendarSync_isIdempotentDone_(wire.syncKeyString)) {
    calendarSync_log_("apply.duplicate", { syncKeyString: wire.syncKeyString });
    return calendarSync_ok_(wire, 0, true);
  }

  try {
    var stepsExecuted = calendarSync_dispatchIntent_(wire);
    calendarSync_markIdempotent_(wire.syncKeyString);
    calendarSync_log_("apply.success", {
      syncKeyString: wire.syncKeyString,
      stepsExecuted: stepsExecuted,
    });
    return calendarSync_ok_(wire, stepsExecuted, false);
  } catch (e) {
    var msg = e && e.message ? String(e.message) : String(e);
    calendarSync_log_("apply.error", { syncKeyString: wire.syncKeyString, message: msg });
    return calendarSync_fail_("APPLY_ERROR", msg, wire);
  }
}

/**
 * @param {Object} bundleWire
 * @param {number} stepsExecuted
 * @param {boolean=} duplicate
 * @return {Object}
 */
function calendarSync_ok_(bundleWire, stepsExecuted, duplicate) {
  return {
    ok: true,
    syncKeyString: bundleWire.syncKeyString,
    status: "SUCCESS",
    stepsExecuted: stepsExecuted || 0,
    duplicate: duplicate === true,
    message: duplicate ? "ALREADY_SYNCED" : undefined,
  };
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Object=} bundleWire
 * @return {Object}
 */
function calendarSync_fail_(code, message, bundleWire) {
  return {
    ok: false,
    code: code,
    message: message,
    syncKeyString: bundleWire && bundleWire.syncKeyString ? bundleWire.syncKeyString : "",
    status: "FAILED",
    stepsExecuted: 0,
  };
}

/**
 * @param {string} event
 * @param {Object=} data
 */
function calendarSync_log_(event, data) {
  try {
    Logger.log("[calendarSyncHost] " + event + (data ? " " + JSON.stringify(data) : ""));
  } catch (e) {}
}

/**
 * @param {Object} bundleWire
 * @return {{ok:boolean, bundle?:Object, code?:string, message?:string}}
 */
function calendarSync_validateBundleShape_(bundleWire) {
  if (!bundleWire || typeof bundleWire !== "object") {
    return { ok: false, code: "MISSING_BUNDLE", message: "Bundle ausente" };
  }
  if (!bundleWire.syncKey || !bundleWire.syncKey.matchId || !bundleWire.syncKey.intent) {
    return { ok: false, code: "MISSING_SYNC_KEY", message: "syncKey incompleto" };
  }
  if (
    !bundleWire.rowKey ||
    !bundleWire.rowKey.grupo ||
    !bundleWire.rowKey.equipoLocal ||
    !bundleWire.rowKey.equipoVisitante
  ) {
    return { ok: false, code: "MISSING_ROW_KEY", message: "rowKey incompleto" };
  }
  if (!bundleWire.row || !bundleWire.row.estadoPartido) {
    return { ok: false, code: "MISSING_ROW", message: "row projection ausente" };
  }
  var intents = ["close", "reopen_acta", "reopen_alignments", "alignment_complete"];
  if (intents.indexOf(bundleWire.syncKey.intent) < 0) {
    return { ok: false, code: "INVALID_INTENT", message: "intent no soportado" };
  }
  if (!bundleWire.syncKeyString) {
    bundleWire.syncKeyString =
      bundleWire.syncKey.category +
      "::" +
      bundleWire.syncKey.phase +
      "::" +
      bundleWire.syncKey.matchId +
      "::v" +
      bundleWire.syncKey.documentVersion +
      "::" +
      bundleWire.syncKey.intent;
  }
  if (!bundleWire.steps) {
    bundleWire.steps = [];
  }
  return { ok: true, bundle: bundleWire };
}

/**
 * @param {string} syncKeyString
 * @return {boolean}
 */
function calendarSync_isIdempotentDone_(syncKeyString) {
  try {
    var cache = CacheService.getScriptCache();
    return cache.get(CALENDAR_SYNC_IDEM_PREFIX_ + syncKeyString) === "1";
  } catch (e) {
    return false;
  }
}

/**
 * @param {string} syncKeyString
 */
function calendarSync_markIdempotent_(syncKeyString) {
  try {
    CacheService.getScriptCache().put(
      CALENDAR_SYNC_IDEM_PREFIX_ + syncKeyString,
      "1",
      CALENDAR_SYNC_IDEM_TTL_SEC_,
    );
  } catch (e) {}
}

/**
 * @param {Object} wire
 * @return {number}
 */
function calendarSync_dispatchIntent_(wire) {
  var intent = wire.syncKey.intent;
  if (intent === "close") {
    return calendarSync_applyCloseBundle_(wire);
  }
  if (intent === "reopen_acta") {
    return calendarSync_applyReopenActaBundle_(wire);
  }
  if (intent === "reopen_alignments") {
    return calendarSync_applyReopenAlignmentsBundle_(wire);
  }
  if (intent === "alignment_complete") {
    return calendarSync_applyAlignmentCompleteBundle_(wire);
  }
  throw new Error("Intent no soportado: " + intent);
}

/**
 * @param {string} name
 * @return {Function|null}
 */
function calendarSync_resolveFn_(name) {
  try {
    if (typeof globalThis !== "undefined" && typeof globalThis[name] === "function") {
      return globalThis[name];
    }
  } catch (e0) {}
  try {
    if (typeof this !== "undefined" && typeof this[name] === "function") {
      return this[name];
    }
  } catch (e1) {}
  try {
    if (typeof etr7_shared_competitionLibraryRoot_ === "function") {
      var comp = etr7_shared_competitionLibraryRoot_();
      if (comp && typeof comp[name] === "function") {
        return comp[name];
      }
    }
  } catch (e2) {}
  return null;
}

/**
 * @param {Object} wire
 * @return {Object}
 */
function calendarSync_buildContext_(wire) {
  var sk = wire.syncKey;
  var rk = wire.rowKey;
  var categoria = sk.category;
  var fase = sk.phase;
  var faseNorm = calendarSync_resolveFn_("normalizarFase")
    ? calendarSync_resolveFn_("normalizarFase")(fase)
    : fase === "Fase II"
      ? "F2"
      : "F1";
  var encounter = {
    grupo: String(rk.grupo).trim(),
    equipoLocal: String(rk.equipoLocal).trim(),
    equipoVisitante: String(rk.equipoVisitante).trim(),
    referencia_encuentro: rk.referenciaEncuentro
      ? String(rk.referenciaEncuentro).trim()
      : "",
  };
  if (faseNorm === "F2" && !encounter.referencia_encuentro) {
    throw new Error("Fase II: referencia_encuentro obligatoria");
  }
  var ctx = {
    categoria: categoria,
    fase: fase,
    faseNorm: faseNorm,
    encounter: encounter,
    matchId: sk.matchId,
    hojaCal: null,
    filaReal: null,
    libroID: null,
    carpetaId: null,
  };
  var getCarpeta = calendarSync_resolveFn_("getCarpetaCached");
  var getLibro = calendarSync_resolveFn_("getLibroIdCached");
  var getSheet = calendarSync_resolveFn_("getSheetCached");
  if (!getCarpeta || !getLibro || !getSheet) {
    throw new Error(
      "Infra calendario no disponible (getCarpetaCached/getLibroIdCached/getSheetCached)",
    );
  }
  var carpeta = getCarpeta(categoria, fase);
  if (!carpeta) {
    throw new Error("No se encontró carpeta de fase");
  }
  ctx.carpetaId = carpeta.getId();
  var nbLibro = faseNorm === "F2" ? "Calendario_Fase2" : "Calendario_Fase1";
  ctx.libroID = getLibro(ctx.carpetaId, nbLibro);
  if (!ctx.libroID) {
    throw new Error("No se encontró libro calendario: " + nbLibro);
  }
  ctx.hojaCal = getSheet(ctx.libroID, "Calendario");
  if (!ctx.hojaCal) {
    throw new Error("No se encontró hoja Calendario");
  }
  var buscarFila = calendarSync_resolveFn_("buscarFilaCalendarioPorEncuentro");
  if (!buscarFila) {
    throw new Error("buscarFilaCalendarioPorEncuentro no disponible");
  }
  ctx.filaReal = buscarFila(ctx.hojaCal, fase, encounter);
  if (!ctx.filaReal) {
    throw new Error("Encuentro no encontrado en Calendario");
  }
  return ctx;
}

/**
 * @param {Object} ctx
 */
function calendarSync_stepRevertCopa_(ctx) {
  if (ctx.faseNorm !== "F2") {
    return;
  }
  var revert = calendarSync_resolveFn_("_cal_f2_revertirSustitucionesCopa_");
  if (!revert) {
    calendarSync_log_("copa.revert.skipped", { reason: "fn_missing" });
    return;
  }
  var cat = ctx.categoria === "F" ? "F" : "M";
  revert(
    cat,
    ctx.matchId,
    ctx.encounter.grupo,
    ctx.encounter.equipoLocal,
    ctx.encounter.equipoVisitante,
    ctx.hojaCal,
  );
}

/**
 * @param {Object} ctx
 * @param {Object} wire
 */
function calendarSync_stepDeleteResultados_(ctx, wire) {
  var getLibro = calendarSync_resolveFn_("getLibroIdCached");
  var getSheet = calendarSync_resolveFn_("getSheetCached");
  var hojaResName =
    ctx.faseNorm === "F2" ? "Resultados_Fase2" : "Resultados_Fase1";
  var hojaRes = getSheet(ctx.libroID, hojaResName);
  if (!hojaRes) {
    return;
  }
  var lr = hojaRes.getLastRow();
  if (lr < 2) {
    return;
  }
  var numCols = hojaRes.getLastColumn();
  var localBusq = ctx.encounter.equipoLocal;
  var visitanteBusq = ctx.encounter.equipoVisitante;
  var refEncF2 = ctx.encounter.referencia_encuentro;
  var colRefResF2 = -1;
  if (ctx.faseNorm === "F2") {
    var hojaIndice = calendarSync_resolveFn_("hojaIndiceColumnaPorCabecera");
    if (!hojaIndice) {
      throw new Error("hojaIndiceColumnaPorCabecera no disponible");
    }
    colRefResF2 = hojaIndice(hojaRes, "referencia_encuentro");
    if (colRefResF2 < 0) {
      throw new Error("Resultados F2 sin columna referencia_encuentro");
    }
  }
  var vals = hojaRes.getRange(2, 1, lr - 1, numCols).getValues();
  var kept = [];
  for (var r = 0; r < vals.length; r++) {
    var eq1 = vals[r][2];
    var eq2 = vals[r][3];
    var matchEq =
      (eq1 === localBusq && eq2 === visitanteBusq) ||
      (eq1 === visitanteBusq && eq2 === localBusq);
    var match = matchEq;
    if (ctx.faseNorm === "F2") {
      var refR = String(vals[r][colRefResF2] || "").trim();
      match = matchEq && refR === refEncF2;
    }
    if (!match) {
      kept.push(vals[r]);
    }
  }
  hojaRes.getRange(2, 1, lr - 1, numCols).clearContent();
  if (kept.length) {
    hojaRes.getRange(2, 1, kept.length, numCols).setValues(kept);
  }
}

/**
 * @param {Object} ctx
 * @param {Object} wire
 */
function calendarSync_stepWriteResultados_(ctx, wire) {
  if (!wire.resultados) {
    return;
  }
  var escribir = calendarSync_resolveFn_("escribirDatosClasificacion");
  if (!escribir) {
    throw new Error("escribirDatosClasificacion no disponible");
  }
  var getSheet = calendarSync_resolveFn_("getSheetCached");
  var hojaResName =
    ctx.faseNorm === "F2" ? "Resultados_Fase2" : "Resultados_Fase1";
  var hojaRes = getSheet(ctx.libroID, hojaResName);
  if (!hojaRes) {
    throw new Error("Hoja resultados no encontrada");
  }
  var res = wire.resultados;
  var row = wire.row;
  var resLocal =
    row.resultadoLocal != null ? Number(row.resultadoLocal) : 0;
  var resVisit =
    row.resultadoVisitante != null ? Number(row.resultadoVisitante) : 0;
  var datos = {
    grupo: ctx.encounter.grupo,
    categoria: ctx.categoria === "F" ? "F" : "M",
    equipoLocal: ctx.encounter.equipoLocal,
    equipoVisitante: ctx.encounter.equipoVisitante,
    resultadoLocal: resLocal,
    resultadoVisitante: resVisit,
    PuntosLocal: res.local.P,
    BOlocal: res.local.BO,
    BDlocal: res.local.BD,
    TotalPuntosLocal: res.local.Total,
    PuntosVisitante: res.visitante.P,
    BOvisitante: res.visitante.BO,
    BDvisitante: res.visitante.BD,
    TotalPuntosVisitante: res.visitante.Total,
    encuentroId: ctx.matchId,
    referencia_encuentro: ctx.encounter.referencia_encuentro,
  };
  var indices = calendarSync_findOrCreateResultadosIndices_(ctx, hojaRes, datos);
  escribir(hojaRes, indices.indiceLV, datos, true, ctx.faseNorm === "F2");
  escribir(hojaRes, indices.indiceVL, datos, false, ctx.faseNorm === "F2");
}

/**
 * @param {Object} ctx
 * @param {Object} datos
 * @return {{indiceLV:number, indiceVL:number}}
 */
function calendarSync_findOrCreateResultadosIndices_(ctx, hojaRes, datos) {
  var numFilas = hojaRes.getLastRow();
  var indiceLV = null;
  var indiceVL = null;
  if (numFilas > 1) {
    var numCols = hojaRes.getLastColumn();
    var icRef = -1;
    var icEnc = -1;
    if (ctx.faseNorm === "F2") {
      var hojaIndice = calendarSync_resolveFn_("hojaIndiceColumnaPorCabecera");
      icRef = hojaIndice(hojaRes, "referencia_encuentro");
      icEnc = hojaIndice(hojaRes, "encuentroId");
    }
    var vals = hojaRes.getRange(2, 1, numFilas - 1, numCols).getValues();
    var refEsp =
      ctx.faseNorm === "F2"
        ? String(datos.referencia_encuentro || "").trim()
        : "";
    for (var i = 0; i < vals.length; i++) {
      if (ctx.faseNorm === "F2") {
        if (String(vals[i][icRef] || "").trim() !== refEsp) {
          continue;
        }
        if (icEnc >= 0 && String(vals[i][icEnc] || "").trim() !== String(datos.encuentroId || "")) {
          continue;
        }
      }
      if (vals[i][2] == datos.equipoLocal && vals[i][3] == datos.equipoVisitante) {
        indiceLV = i + 2;
      }
      if (vals[i][2] == datos.equipoVisitante && vals[i][3] == datos.equipoLocal) {
        indiceVL = i + 2;
      }
    }
    if (indiceLV == null && indiceVL == null) {
      indiceLV = numFilas + 1;
      indiceVL = indiceLV + 1;
    } else if (indiceLV == null) {
      indiceLV = numFilas + 1;
      if (indiceLV === indiceVL) {
        indiceLV = indiceVL + 1;
      }
    } else if (indiceVL == null) {
      indiceVL = numFilas + 1;
      if (indiceVL === indiceLV) {
        indiceVL = indiceLV + 1;
      }
    }
  } else {
    indiceLV = 2;
    indiceVL = 3;
  }
  return { indiceLV: indiceLV, indiceVL: indiceVL };
}

/**
 * @param {Object} ctx
 * @param {Object} wire
 */
function calendarSync_stepUpdateCalendarRow_(ctx, wire) {
  var row = wire.row;
  var fila = ctx.filaReal;
  var lastCol = ctx.hojaCal.getLastColumn();
  var rowVals = ctx.hojaCal.getRange(fila, 1, 1, lastCol).getValues()[0];

  if (row.resultadoLocal == null) {
    rowVals[5] = "";
  } else {
    rowVals[5] = row.resultadoLocal;
  }
  if (row.resultadoVisitante == null) {
    rowVals[6] = "";
  } else {
    rowVals[6] = row.resultadoVisitante;
  }
  rowVals[7] = row.estadoAlineacionLocal;
  rowVals[9] = row.estadoAlineacionVisitante;
  rowVals[10] = row.estadoPartido;

  if (row.clearPdfColumn) {
    try {
      var hm = calendarSync_resolveFn_("getHeaderMapCached");
      var norm = calendarSync_resolveFn_("hojaNormalizarNombreCabeceraCal_");
      if (hm && norm) {
        var hmCal = hm(ctx.hojaCal);
        var pdfCols = hmCal[norm("PDF")] || [];
        if (pdfCols.length) {
          rowVals[pdfCols[0]] = "";
        }
      }
    } catch (ePdf) {}
  }

  ctx.hojaCal.getRange(fila, 1, 1, lastCol).setValues([rowVals]);
}

/**
 * @param {Object} ctx
 */
function calendarSync_stepRecalcGlobal_(ctx) {
  var recalc = calendarSync_resolveFn_("recalcularClasificacion");
  if (recalc) {
    recalc(ctx.categoria, ctx.fase);
    return;
  }
  var recalcCat = calendarSync_resolveFn_("recalcularClasificacionCategoria");
  if (recalcCat) {
    recalcCat(ctx.categoria, ctx.fase);
  }
}

/**
 * @param {Object} ctx
 */
function calendarSync_stepTrashPdf_(ctx) {
  try {
    var folder = DriveApp.getFolderById(ctx.carpetaId);
    var texto =
      String(ctx.encounter.equipoLocal) + " - " + String(ctx.encounter.equipoVisitante);
    var it = folder.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      var nm = f.getName();
      if (nm.indexOf("ACTA_") === 0 && nm.indexOf(texto) !== -1) {
        var pdfName = "PDF_" + nm + ".pdf";
        var pdfs = folder.getFilesByName(pdfName);
        while (pdfs.hasNext()) {
          try {
            pdfs.next().setTrashed(true);
          } catch (eT) {}
        }
      }
    }
  } catch (e) {
    calendarSync_log_("pdf.trash.warn", { message: String(e) });
  }
}

/**
 * @param {Object} ctx
 */
function calendarSync_stepInvalidateCache_(ctx) {
  var invHoja = calendarSync_resolveFn_("invalidateCalendarioDataCacheForHoja");
  if (invHoja && ctx.hojaCal) {
    invHoja(ctx.hojaCal);
  }
  var invCanon = calendarSync_resolveFn_("invalidarCacheCalendarioCanonico");
  if (invCanon) {
    invCanon(ctx.categoria, ctx.fase);
  }
}

/**
 * @param {Object} wire
 * @return {number}
 */
function calendarSync_applyCloseBundle_(wire) {
  var ctx = calendarSync_buildContext_(wire);
  var executed = 0;
  calendarSync_stepRevertCopa_(ctx);
  executed++;
  if (wire.resultados) {
    calendarSync_stepWriteResultados_(ctx, wire);
    executed++;
  }
  calendarSync_stepUpdateCalendarRow_(ctx, wire);
  executed++;
  calendarSync_stepRecalcGlobal_(ctx);
  executed++;
  calendarSync_stepInvalidateCache_(ctx);
  executed++;
  return executed;
}

/**
 * @param {Object} wire
 * @return {number}
 */
function calendarSync_applyReopenActaBundle_(wire) {
  var ctx = calendarSync_buildContext_(wire);
  var executed = 0;
  calendarSync_stepRevertCopa_(ctx);
  executed++;
  calendarSync_stepDeleteResultados_(ctx, wire);
  executed++;
  calendarSync_stepTrashPdf_(ctx);
  executed++;
  calendarSync_stepUpdateCalendarRow_(ctx, wire);
  executed++;
  calendarSync_stepInvalidateCache_(ctx);
  executed++;
  return executed;
}

/**
 * @param {Object} wire
 * @return {number}
 */
function calendarSync_applyReopenAlignmentsBundle_(wire) {
  var ctx = calendarSync_buildContext_(wire);
  var executed = 0;
  calendarSync_stepRevertCopa_(ctx);
  executed++;
  calendarSync_stepDeleteResultados_(ctx, wire);
  executed++;
  if (wire.row.clearPdfColumn) {
    calendarSync_stepTrashPdf_(ctx);
    executed++;
  }
  calendarSync_stepUpdateCalendarRow_(ctx, wire);
  executed++;
  calendarSync_stepRecalcGlobal_(ctx);
  executed++;
  calendarSync_stepInvalidateCache_(ctx);
  executed++;
  return executed;
}

/**
 * @param {Object} wire
 * @return {number}
 */
function calendarSync_applyAlignmentCompleteBundle_(wire) {
  var ctx = calendarSync_buildContext_(wire);
  calendarSync_stepUpdateCalendarRow_(ctx, wire);
  calendarSync_stepInvalidateCache_(ctx);
  return 2;
}
