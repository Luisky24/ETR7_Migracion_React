import type { MatchClosureErrorCode } from '../contracts/errors.contract'
import type { NormalizedOperationError, OperationErrorCategory } from '../types/matchReportOperation.types'

const USER_MESSAGES: Readonly<Record<string, string>> = {
  LINEUPS_NOT_FOUND: 'No se encontraron alineaciones para este encuentro.',
  ACTA_NOT_FOUND: 'No existe acta o datos incompletos en el servidor.',
  MISSING_REFERENCIA_F2: 'Falta referencia de encuentro (Fase II).',
  COPA_DRAW_NOT_ALLOWED: 'No se puede cerrar un empate en grupo COPA.',
  COPA_PLACEHOLDER_NOT_FOUND: 'No se pudo resolver el encuentro COPA en calendario.',
  VALIDATION_FAILED: 'La validación del acta no permite continuar.',
  SERVER_ERROR: 'Error del servidor al procesar el acta.',
  TIMEOUT: 'La operación tardó demasiado. Compruebe la conexión.',
  WIRE_INVALID: 'Respuesta del servidor no válida.',
  WIRE_INCOMPLETE: 'Respuesta del servidor incompleta.',
  CORRUPT_DOCUMENT: 'El acta JSON está dañada o es inválida.',
  DOCUMENT_VERSION_CONFLICT:
    'El acta fue modificada en otro lugar. Recargue el encuentro y vuelva a guardar.',
  NETWORK_ERROR: 'Error de red o GAS no disponible.',
  DUPLICATE_OPERATION: 'Ya hay una operación en curso.',
  UNKNOWN: 'Error inesperado.',
}

function categoryForCode(code: string): OperationErrorCategory {
  if (code === 'VALIDATION_FAILED' || code.startsWith('COPA_')) return 'validation'
  if (code === 'WIRE_INVALID' || code === 'WIRE_INCOMPLETE') return 'wire'
  if (code === 'TIMEOUT' || code === 'NETWORK_ERROR' || code === 'SERVER_ERROR') return 'infrastructure'
  return 'domain'
}

function isRetryableCode(code: string): boolean {
  return ['TIMEOUT', 'NETWORK_ERROR', 'SERVER_ERROR'].includes(code)
}

function shouldReloadForCode(code: string): boolean {
  return ['LINEUPS_NOT_FOUND', 'ACTA_NOT_FOUND', 'WIRE_INVALID', 'WIRE_INCOMPLETE', 'CORRUPT_DOCUMENT'].includes(
    code,
  )
}

function shouldBlockForCode(code: string): boolean {
  return ['MISSING_REFERENCIA_F2', 'COPA_DRAW_NOT_ALLOWED', 'CORRUPT_DOCUMENT'].includes(code)
}

export function normalizeErrorCode(raw: string): string {
  const known: readonly MatchClosureErrorCode[] = [
    'COPA_DRAW_NOT_ALLOWED',
    'COPA_PLACEHOLDER_NOT_FOUND',
    'MISSING_REFERENCIA_F2',
    'LINEUPS_NOT_FOUND',
    'ACTA_NOT_FOUND',
    'DRAFT_NO_ACTIONS',
    'VALIDATION_FAILED',
    'SERVER_ERROR',
    'UNKNOWN',
  ]
  if (known.includes(raw as MatchClosureErrorCode)) return raw
  return inferCodeFromMessage(raw)
}

function inferCodeFromMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('timeout')) return 'TIMEOUT'
  if (m.includes('google apps script') || m.includes('gas no detectado')) return 'NETWORK_ERROR'
  if (m.includes('referencia')) return 'MISSING_REFERENCIA_F2'
  if (m.includes('alineacion') || m.includes('lineup')) return 'LINEUPS_NOT_FOUND'
  if (m.includes('empate') && m.includes('copa')) return 'COPA_DRAW_NOT_ALLOWED'
  if (m.includes('placeholder')) return 'COPA_PLACEHOLDER_NOT_FOUND'
  if (m.includes('incomplet') || m.includes('inválid') || m.includes('invalid')) return 'WIRE_INVALID'
  if (m.includes('validación') || m.includes('validation')) return 'VALIDATION_FAILED'
  return 'SERVER_ERROR'
}

export function normalizeOperationError(
  input: unknown,
  overrides?: Partial<Pick<NormalizedOperationError, 'code' | 'category'>>,
): NormalizedOperationError {
  const technicalMessage =
    input instanceof Error ? input.message : typeof input === 'string' ? input : 'Error desconocido'
  const code = normalizeErrorCode(overrides?.code ?? inferCodeFromMessage(technicalMessage))
  const category = overrides?.category ?? categoryForCode(code)
  const userMessage = USER_MESSAGES[code] ?? USER_MESSAGES.UNKNOWN ?? 'Error inesperado.'
  const recoverable = !shouldBlockForCode(code)
  return {
    code,
    userMessage,
    technicalMessage,
    category,
    recoverable,
    retryable: isRetryableCode(code) && recoverable,
    shouldReload: shouldReloadForCode(code),
    shouldBlock: shouldBlockForCode(code),
  }
}

export function normalizedValidationError(message: string): NormalizedOperationError {
  return normalizeOperationError(message, { code: 'VALIDATION_FAILED', category: 'validation' })
}

export function normalizedWireError(code: 'WIRE_INVALID' | 'WIRE_INCOMPLETE', detail?: string): NormalizedOperationError {
  return normalizeOperationError(detail ?? code, { code, category: 'wire' })
}

export function normalizedDuplicateOperationError(): NormalizedOperationError {
  return normalizeOperationError('DUPLICATE_OPERATION', { code: 'DUPLICATE_OPERATION', category: 'infrastructure' })
}
