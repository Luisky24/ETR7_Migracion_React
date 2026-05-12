/**
 * Acceso defensivo a sessionStorage (p. ej. modo privado o deshabilitado).
 * No usar window.*; el binding global sessionStorage es el contrato del runtime browser.
 */
export function getSessionStorageSafe(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    return sessionStorage
  } catch {
    return null
  }
}
