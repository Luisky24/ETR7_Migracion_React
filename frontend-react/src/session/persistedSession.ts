import type { AuthRole, AuthTeamSnapshot } from '@/contracts/auth.contract'
import {
  CAPABILITY_KEYS,
  createCapabilities,
  type UserCapabilities,
} from '@/contracts/capabilities.contract'

/** Versión del blob persistido; incrementar solo con migración explícita. */
export const PERSISTED_SESSION_VERSION = 1 as const

export const SESSION_STORAGE_KEY = 'etr7.session.v1'

export interface PersistedSessionUserV1 {
  readonly id: string
  readonly displayName: string
  readonly role: AuthRole
  readonly capabilities: UserCapabilities
  readonly team?: AuthTeamSnapshot
}

export interface PersistedSessionV1 {
  readonly v: typeof PERSISTED_SESSION_VERSION
  readonly user: PersistedSessionUserV1
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === 'staff' || value === 'lcv' || value === 'arbitro' || value === 'team'
}

function isUserCapabilities(value: unknown): value is Partial<UserCapabilities> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const o = value as Record<string, unknown>
  return CAPABILITY_KEYS.every((k) => o[k] === undefined || typeof o[k] === 'boolean')
}

function isTeamSnapshot(value: unknown): value is AuthTeamSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const o = value as Record<string, unknown>
  return typeof o.maleTeamLabel === 'string' && typeof o.femaleTeamLabel === 'string'
}

function isPersistedUser(value: unknown): value is PersistedSessionUserV1 {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const o = value as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id.length === 0) {
    return false
  }
  if (typeof o.displayName !== 'string') {
    return false
  }
  if (!isAuthRole(o.role)) {
    return false
  }
  if (!isUserCapabilities(o.capabilities)) {
    return false
  }
  if (o.team !== undefined && !isTeamSnapshot(o.team)) {
    return false
  }
  return true
}

export function parsePersistedSession(raw: string | null): PersistedSessionV1 | null {
  if (raw === null || raw === '') {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null
  }
  const o = parsed as Record<string, unknown>
  if (o.v !== PERSISTED_SESSION_VERSION) {
    return null
  }
  if (!isPersistedUser(o.user)) {
    return null
  }
  return { v: PERSISTED_SESSION_VERSION, user: normalizePersistedUser(o.user) }
}

export function serializePersistedSession(snapshot: PersistedSessionV1): string {
  return JSON.stringify(snapshot)
}

/** Normaliza capabilities persistidas antiguas o parciales a la forma actual. */
export function normalizePersistedUser(user: PersistedSessionUserV1): PersistedSessionUserV1 {
  const caps = createCapabilities(user.capabilities)
  return { ...user, capabilities: caps }
}

export function readPersistedSessionFromStorage(getItem: (key: string) => string | null): PersistedSessionV1 | null {
  const parsed = parsePersistedSession(getItem(SESSION_STORAGE_KEY))
  if (!parsed) {
    return null
  }
  return { v: parsed.v, user: normalizePersistedUser(parsed.user) }
}

export function writePersistedSessionToStorage(
  setItem: (key: string, value: string) => void,
  snapshot: PersistedSessionV1,
): void {
  setItem(SESSION_STORAGE_KEY, serializePersistedSession(snapshot))
}

export function clearPersistedSessionFromStorage(removeItem: (key: string) => void): void {
  removeItem(SESSION_STORAGE_KEY)
}
