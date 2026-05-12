/**
 * Permisos explícitos de la SPA (sin niveles numéricos ni flags legacy en UI).
 * Ampliar aquí; el menú y guards consumen solo este modelo.
 */

export interface UserCapabilities {
  readonly canAccessMenu: boolean
  readonly canAccessCalendar: boolean
  readonly canManageTeam: boolean
}

export const CAPABILITY_KEYS = [
  'canAccessMenu',
  'canAccessCalendar',
  'canManageTeam',
] as const satisfies readonly (keyof UserCapabilities)[]

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number]

export function createCapabilities(partial: Partial<UserCapabilities> = {}): UserCapabilities {
  return {
    canAccessMenu: partial.canAccessMenu ?? false,
    canAccessCalendar: partial.canAccessCalendar ?? false,
    canManageTeam: partial.canManageTeam ?? false,
  }
}

export function hasCapability(caps: UserCapabilities, key: CapabilityKey): boolean {
  return caps[key]
}
