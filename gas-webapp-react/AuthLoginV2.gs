/**
 * Boundary React host: `auth_login_v2` (contrato estable).
 *
 * Delegación vía {@link etr7_shared_resolvePhase1Ns_} — LOCAL (symlinks) o LIBRARY (`ETR7Shared`).
 *
 * @fileoverview ETR7 — AUTH host (HtmlService); Phase 4 dual runtime.
 */

/**
 * @param {string} claveValidacion
 * @return {Object}
 */
function auth_login_v2(claveValidacion) {
  var ns = etr7_shared_resolvePhase1Ns_();
  if (!ns || typeof ns.authLoginV2 !== "function") {
    return {
      version: 2,
      authenticated: false,
      error: {
        code: "AUTH_SERVER",
        message: "Runtime shared no disponible (revisar ETR7_Shared_LibraryBridge y modo LOCAL/LIBRARY).",
      },
    };
  }
  return ns.authLoginV2(claveValidacion, {
    validarUsuario: validarUsuario,
  });
}
