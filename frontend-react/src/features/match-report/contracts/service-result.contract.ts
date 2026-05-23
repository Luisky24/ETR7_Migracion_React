import type { NormalizedOperationError } from '../types/matchReportOperation.types'

export type ServiceResultKind = 'success' | 'recoverableError' | 'fatalError' | 'validationError'

export interface ServiceResultSuccess<T> {
  readonly kind: 'success'
  readonly data: T
}

export interface ServiceResultRecoverableError {
  readonly kind: 'recoverableError'
  readonly error: NormalizedOperationError
}

export interface ServiceResultFatalError {
  readonly kind: 'fatalError'
  readonly error: NormalizedOperationError
}

export interface ServiceResultValidationError {
  readonly kind: 'validationError'
  readonly error: NormalizedOperationError
}

export type ServiceResult<T> =
  | ServiceResultSuccess<T>
  | ServiceResultRecoverableError
  | ServiceResultFatalError
  | ServiceResultValidationError

export function serviceSuccess<T>(data: T): ServiceResultSuccess<T> {
  return { kind: 'success', data }
}

export function serviceRecoverableError(error: NormalizedOperationError): ServiceResultRecoverableError {
  return { kind: 'recoverableError', error }
}

export function serviceFatalError(error: NormalizedOperationError): ServiceResultFatalError {
  return { kind: 'fatalError', error }
}

export function serviceValidationError(error: NormalizedOperationError): ServiceResultValidationError {
  return { kind: 'validationError', error }
}

export function isServiceSuccess<T>(r: ServiceResult<T>): r is ServiceResultSuccess<T> {
  return r.kind === 'success'
}
