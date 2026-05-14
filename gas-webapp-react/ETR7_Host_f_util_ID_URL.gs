function obtenerIDyURLCarpeta(carpeta_selecc) {
  //Logger.log("Carpeta a buscar: " + carpeta_selecc)
  //Obtener el ID de una carpeta por su nombre
  var carpetas = DriveApp.getFoldersByName(carpeta_selecc);
  let carpeta_ID = null;
  let carpeta_URL = null;

  if (!carpetas.hasNext()) {
    if (typeof diagnosticarRutaDrive === "function") {
      diagnosticarRutaDrive("Carpeta", carpeta_selecc, null);
    }
    throw new Error("La carpeta " + carpeta_selecc + " no existe");
  }

  while (carpetas.hasNext()) {
    var carpeta = carpetas.next();
    carpeta_ID = carpeta.getId();
    carpeta_URL = carpeta.getUrl();
    //  Logger.log("ID de la carpeta '" + carpeta_selecc + "': " + carpeta_ID);
    //  Logger.log("URL de la carpeta " + carpeta_selecc + " es " + carpeta_URL)
  }

  return [carpeta_ID, carpeta_URL];
}

/*-------------------------------------------------------------------------------------------------------------*/
/* ----------------------------------------------------------------------
  PARAMETROS ENTRADA:
  -> carpeta_selec_ID: El ID de la carpeta donde buscamos el libro
  -> nb_libro_selecc: el nombre (string) del libro que se busca

  PARAMETROS DE SALIDA:
  -> libroID: El ID del libro buscado
------------------------------------------------------------------------- */

function obtener_ID_Libro_x_ID_Carpeta(carpeta_selec_ID, nb_libro_selecc) {
  let carpeta_ID = carpeta_selec_ID;
  let nb = nb_libro_selecc != null ? String(nb_libro_selecc).trim() : "";
  if (!carpeta_ID || !nb) return null;

  function invalidarCacheLibroPorClave_(key) {
    try { CacheService.getScriptCache().remove(key); } catch (e) {}
    try { PropertiesService.getScriptProperties().deleteProperty(key); } catch (e2) {}
  }

  // Cache transversal: carpetaId + nombreLibro -> fileId
  // Evita iterar todos los archivos del folder en cada llamada.
  let key = "BOOK_ID_V1::" + String(carpeta_ID) + "::" + nb;
  try {
    let cache = CacheService.getScriptCache();
    let cached = cache.get(key);
    if (cached) {
      try {
        let f0 = DriveApp.getFileById(cached);
        // Política A: si está en papelera, se trata como inexistente.
        if (f0 && f0.getName && f0.getName() === nb && !f0.isTrashed()) return cached;
        invalidarCacheLibroPorClave_(key);
      } catch (e0) {
        // stale -> continuar
        invalidarCacheLibroPorClave_(key);
      }
    }
  } catch (eCache) {}
  try {
    let props = PropertiesService.getScriptProperties();
    let pid = props.getProperty(key);
    if (pid) {
      try {
        let f1 = DriveApp.getFileById(pid);
        if (f1 && f1.getName && f1.getName() === nb && !f1.isTrashed()) {
          try {
            CacheService.getScriptCache().put(key, pid, 21600);
          } catch (ePut) {}
          return pid;
        }
        invalidarCacheLibroPorClave_(key);
      } catch (e1) {
        // stale -> continuar
        invalidarCacheLibroPorClave_(key);
      }
    }
  } catch (eProps) {}

  // Obtener la carpeta, fisicamente
  let carpeta_tj = DriveApp.getFolderById(carpeta_ID);

  // Fast-path Drive: buscar por nombre directamente
  let byName = null;
  try {
    byName = carpeta_tj.getFilesByName(nb);
  } catch (eBy) {
    byName = null;
  }
  if (byName && byName.hasNext()) {
    let libroID = null;
    while (byName.hasNext()) {
      let archivo = byName.next();
      try {
        if (archivo && !archivo.isTrashed()) {
          libroID = archivo.getId();
          break;
        }
      } catch (eTrash) {}
    }
    if (libroID) {
      try { CacheService.getScriptCache().put(key, libroID, 21600); } catch (ePut2) {}
      try { PropertiesService.getScriptProperties().setProperty(key, libroID); } catch (ePut3) {}
      return libroID;
    }
  }

  // Fallback legacy: iterar todos los archivos dentro de la carpeta (solo si fuese necesario)
  let archivos = carpeta_tj.getFiles();
  let libroID = null;
  while (archivos.hasNext()) {
    let archivo = archivos.next();
    if (archivo.getName() == nb) {
      try {
        if (archivo.isTrashed && archivo.isTrashed()) continue;
      } catch (eT2) {}
      libroID = archivo.getId();
      break;
    }
  }
  if (libroID) {
    try {
      CacheService.getScriptCache().put(key, libroID, 21600);
    } catch (ePut4) {}
    try {
      PropertiesService.getScriptProperties().setProperty(key, libroID);
    } catch (ePut5) {}
  }
  return libroID;
}

function obtener_hjInscripcionesEquipos() {
  let idURLCarpeta = obtenerIDyURLCarpeta("Control");
  let idSheetEquipos = obtener_ID_Libro_x_ID_Carpeta(
    idURLCarpeta[0],
    "Inscripciones Equipos",
  );
  let openLibroEquipos = SpreadsheetApp.openById(idSheetEquipos);
  let hoja = openLibroEquipos.getSheetByName("Inscripciones Equipos");
  return hoja;
}

function obtenerHoja(carpeta, libro, hojaIN) {
  let carpetaM = obtenerIDyURLCarpeta(carpeta);
  let libroID = obtener_ID_Libro_x_ID_Carpeta(carpetaM[0], libro);
  let libroDispo = SpreadsheetApp.openById(libroID);
  let hoja = libroDispo.getSheetByName(hojaIN);

  return hoja;
}

function obtenerHojaID(carpetaID, libroID, hojaIN) {
  let libroDispo = SpreadsheetApp.openById(libroID);
  let hoja = libroDispo.getSheetByName(hojaIN);

  return hoja;
}

function crearLibroEnCarpeta(nombreCarpeta, nombreArchivo) {
  // Obtener la carpeta específica por nombre
  var carpetas = DriveApp.getFoldersByName(nombreCarpeta);

  if (carpetas.hasNext()) {
    var carpeta = carpetas.next(); // Tomar la primera carpeta encontrada con ese nombre
    var archivo = SpreadsheetApp.create(nombreArchivo); // Crear un nuevo libro
    var archivoId = archivo.getId();

    // Mover el archivo a la carpeta
    var archivoDrive = DriveApp.getFileById(archivoId);
    carpeta.addFile(archivoDrive); // Agregar el archivo a la carpeta
    DriveApp.getRootFolder().removeFile(archivoDrive); // Quitarlo de la raíz de Drive

    Logger.log("Archivo creado en la carpeta: " + carpeta.getName());
    return archivoId; // Devolver el ID del libro creado
  } else {
    Logger.log("No se encontró la carpeta: " + nombreCarpeta);
    return null; // Devolver null si la carpeta no existe
  }
}

function existeLibroEnCarpeta(nombreLibro, idCarpeta) {
  const carpeta = DriveApp.getFolderById(idCarpeta);
  const archivos = carpeta.getFilesByName(nombreLibro);
  // Importante: si existe solo en papelera, NO debe considerarse como "existe".
  // Esto evita que flujos como ACTA reutilicen un archivo trashed.
  while (archivos.hasNext()) {
    const f = archivos.next();
    try {
      if (f && typeof f.isTrashed === "function") {
        if (!f.isTrashed()) return true;
      } else {
        // Si no hay método isTrashed (caso raro), asumimos que es válido.
        return true;
      }
    } catch (e) {
      // Si falla isTrashed por cualquier motivo, no damos por existente.
    }
  }
  return false;
}

function crearHojaEnLibro(idLibro, nombreHoja) {
  var libro = SpreadsheetApp.openById(idLibro); // Abre el libro por su ID
  var hoja = libro.getSheetByName(nombreHoja); // Verifica si la hoja ya existe

  if (!hoja) {
    libro.insertSheet(nombreHoja); // Crea la hoja si no existe
    Logger.log("Hoja '" + nombreHoja + "' creada exitosamente.");
  } else {
    Logger.log("La hoja '" + nombreHoja + "' ya existe.");
  }
}

function renombrarHoja(idLibro, nombreActual, nuevoNombre) {
  var libro = SpreadsheetApp.openById(idLibro);
  var hoja = libro.getSheetByName(nombreActual);

  if (hoja) {
    hoja.setName(nuevoNombre);
    Logger.log("Hoja renombrada a: " + nuevoNombre);
    return libro;
  } else {
    Logger.log("La hoja '" + nombreActual + "' no existe.");
  }
}
