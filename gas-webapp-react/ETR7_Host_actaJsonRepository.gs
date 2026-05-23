/**
 * Persistencia JSON oficial de actas en Drive (ETR7 React).
 * Pipeline: read → parse → validate → tmp → verify → replace → verify.
 * PROHIBIDO delete + recreate del documento oficial (usa setContent / backup).
 */

/**
 * @param {Object} payload
 * @param {string} payload.category - "M" | "F"
 * @param {string} payload.phase - "Fase I" | "Fase II" | Fase1 | Fase2
 * @param {string} payload.matchId
 * @return {Object}
 */
/**
 * @param {Object} payload - { category, phase, matchId }
 * @return {Object} - { ok, state: 'absent'|'valid'|'corrupt' }
 */
function actaJson_probeDocument(payload) {
  try {
    var found = actaJson_findByMatchId_(payload);
    if (!found) {
      return { ok: true, state: "absent" };
    }
    var parsed = actaJson_safeParse_(found.content);
    if (!parsed.ok) {
      return { ok: true, state: "corrupt", message: parsed.error };
    }
    var basic = actaJson_basicValidate_(parsed.value, payload.matchId);
    if (!basic.ok) {
      return { ok: true, state: "corrupt", message: basic.message };
    }
    return { ok: true, state: "valid" };
  } catch (e) {
    return actaJson_error_("IO_FAILURE", e);
  }
}

function actaJson_resolveLifecycle(payload) {
  try {
    var found = actaJson_findByMatchId_(payload);
    if (!found) {
      return { ok: true, lifecycle: "NO_EXISTE" };
    }
    var status = found.doc && found.doc.metadata && found.doc.metadata.status;
    if (status === "ACTA_CERRADA") {
      return { ok: true, lifecycle: "ACTA_CERRADA" };
    }
    return { ok: true, lifecycle: "ACTA_EN_CURSO" };
  } catch (e) {
    return actaJson_error_("IO_FAILURE", e);
  }
}

/**
 * @param {Object} payload
 * @return {Object}
 */
function actaJson_readByMatchId(payload) {
  try {
    var found = actaJson_findByMatchId_(payload);
    if (!found) {
      return { ok: true, document: null };
    }
    var parsed = actaJson_safeParse_(found.content);
    if (!parsed.ok) {
      return { ok: false, code: "CORRUPT_DOCUMENT", message: "JSON inválido: " + parsed.error };
    }
    var basic = actaJson_basicValidate_(parsed.value, payload.matchId);
    if (!basic.ok) {
      return { ok: false, code: "CORRUPT_DOCUMENT", message: basic.message };
    }
    return { ok: true, document: parsed.value };
  } catch (e) {
    return actaJson_error_("IO_FAILURE", e);
  }
}

/**
 * @param {Object} payload
 * @param {string} payload.documentName
 * @param {string} payload.content - JSON serializado
 * @return {Object}
 */
function actaJson_atomicWrite(payload) {
  try {
    if (!payload || !payload.documentName || !payload.content) {
      return { ok: false, code: "VALIDATION_FAILED", message: "documentName y content requeridos" };
    }

    var folder = actaJson_getPhaseFolder_(payload);
    var documentName = String(payload.documentName);
    var jsonContent = String(payload.content);

    var parsed = actaJson_safeParse_(jsonContent);
    if (!parsed.ok) {
      return { ok: false, code: "VALIDATION_FAILED", message: "JSON inválido: " + parsed.error };
    }

    var basic = actaJson_basicValidate_(parsed.value, payload.matchId);
    if (!basic.ok) {
      return { ok: false, code: "VALIDATION_FAILED", message: basic.message };
    }

    var result = actaJson_atomicReplaceInFolder_(folder, documentName, jsonContent);
    if (!result.ok) {
      return result;
    }

    Logger.log(
      "[actaJson] atomicWrite ok matchId=" +
        String(payload.matchId) +
        " file=" +
        documentName +
        ".json",
    );
    return { ok: true };
  } catch (e) {
    return actaJson_error_("IO_FAILURE", e);
  }
}

// ——— Drive helpers ———

function actaJson_getPhaseFolder_(payload) {
  var cat = payload.category === "F" ? "Femenina" : "Masculina";
  var fase = payload.phase;
  if (fase === "Fase I" || fase === "Fase1" || fase === "F1") {
    fase = "Fase1";
  } else if (fase === "Fase II" || fase === "Fase2" || fase === "F2") {
    fase = "Fase2";
  }
  return obtenerCarpetaCompeticion(cat, fase);
}

function actaJson_findByMatchId_(payload) {
  var folder = actaJson_getPhaseFolder_(payload);
  var matchId = String(payload.matchId || "");
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    if (!actaJson_isOfficialJson_(name)) continue;
    try {
      var content = file.getBlob().getDataAsString("utf-8");
      var parsed = actaJson_safeParse_(content);
      if (!parsed.ok) continue;
      if (parsed.value && parsed.value.match && parsed.value.match.matchId === matchId) {
        return { file: file, content: content, doc: parsed.value, documentName: name.replace(/\.json$/, "") };
      }
    } catch (eRead) {
      // skip unreadable
    }
  }
  return null;
}

function actaJson_isOfficialJson_(name) {
  if (!name || name.slice(-5) !== ".json") return false;
  if (name.indexOf(".json.") >= 0) return false;
  return true;
}

function actaJson_atomicReplaceInFolder_(folder, documentName, jsonContent) {
  var officialName = documentName + ".json";
  var tmpName = documentName + ".json.tmp";
  var backupName = documentName + ".json.backup";
  var previousName = documentName + ".json.previous";

  actaJson_removeFilesByName_(folder, tmpName);

  folder.createFile(tmpName, jsonContent, MimeType.PLAIN_TEXT);
  var tmpFiles = folder.getFilesByName(tmpName);
  if (!tmpFiles.hasNext()) {
    return { ok: false, code: "IO_FAILURE", message: "No se creó fichero tmp" };
  }
  var tmpFile = tmpFiles.next();
  var tmpRead = tmpFile.getBlob().getDataAsString("utf-8");
  if (tmpRead !== jsonContent) {
    actaJson_removeFile_(tmpFile);
    return { ok: false, code: "IO_FAILURE", message: "Verificación tmp fallida" };
  }

  var officialFiles = folder.getFilesByName(officialName);
  if (officialFiles.hasNext()) {
    var official = officialFiles.next();
    var previousContent = official.getBlob().getDataAsString("utf-8");
    actaJson_removeFilesByName_(folder, backupName);
    actaJson_removeFilesByName_(folder, previousName);
    folder.createFile(backupName, previousContent, MimeType.PLAIN_TEXT);
    folder.createFile(previousName, previousContent, MimeType.PLAIN_TEXT);
    official.setContent(jsonContent);
  } else {
    folder.createFile(officialName, jsonContent, MimeType.PLAIN_TEXT);
  }

  actaJson_removeFile_(tmpFile);

  var verifyFiles = folder.getFilesByName(officialName);
  if (!verifyFiles.hasNext()) {
    return { ok: false, code: "IO_FAILURE", message: "Verificación final: oficial ausente" };
  }
  var verifyContent = verifyFiles.next().getBlob().getDataAsString("utf-8");
  if (verifyContent !== jsonContent) {
    return { ok: false, code: "IO_FAILURE", message: "Verificación final: contenido distinto" };
  }

  return { ok: true };
}

function actaJson_removeFilesByName_(folder, name) {
  var it = folder.getFilesByName(name);
  while (it.hasNext()) {
    actaJson_removeFile_(it.next());
  }
}

function actaJson_removeFile_(file) {
  try {
    file.setTrashed(true);
  } catch (e) {
    try {
      DriveApp.removeFile(file);
    } catch (e2) {}
  }
}

function actaJson_safeParse_(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

function actaJson_basicValidate_(doc, expectedMatchId) {
  if (!doc || typeof doc !== "object") {
    return { ok: false, message: "Documento no es objeto" };
  }
  if (!doc.metadata || doc.metadata.schemaVersion !== 1) {
    return { ok: false, message: "schemaVersion inválido" };
  }
  if (!doc.match || !doc.match.matchId) {
    return { ok: false, message: "matchId ausente" };
  }
  if (expectedMatchId && doc.match.matchId !== expectedMatchId) {
    return { ok: false, message: "matchId no coincide" };
  }
  if (doc.metadata.status === "ACTA_CERRADA" && !doc.metadata.closedAt) {
    return { ok: false, message: "ACTA_CERRADA sin closedAt" };
  }
  if (!doc.classification || !doc.classification.local || !doc.classification.visitante) {
    return { ok: false, message: "classification requerida" };
  }
  return { ok: true };
}

function actaJson_error_(code, e) {
  var msg = e && e.message ? e.message : String(e);
  Logger.log("[actaJson] error " + code + ": " + msg);
  return { ok: false, code: code, message: msg };
}
