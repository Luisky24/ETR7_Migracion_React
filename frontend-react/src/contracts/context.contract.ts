/**
 * Envelope contractual base para respuestas frontend ↔ backend (GAS u otro).
 * `ok: true` + `data` | `ok: false` + `error` — sin lógica de transporte aquí.
 */

export interface ContractSuccess<T> {
  ok: true
  data: T
}

export interface ContractError {
  code: string
  message: string
  details?: unknown
}

export interface ContractFailure {
  ok: false
  error: ContractError
}

export type ContractResult<T> = ContractSuccess<T> | ContractFailure

export function ok<T>(data: T): ContractSuccess<T> {
  return { ok: true, data }
}

export function err(error: ContractError): ContractFailure {
  return { ok: false, error }
}
