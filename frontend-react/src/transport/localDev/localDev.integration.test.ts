import { describe, expect, it } from 'vitest'
import { authLogin } from '@/adapters/authAdapter'
import { calendarService } from '@/features/calendar/services/calendar.service'
import { isLocalSpaDevMode } from '@/app/localDevMode'
import { gasTransport } from '@/transport/gasTransport'
import { mockAuthLoginV2Response } from './mockAuthLogin'

describe('local SPA dev mode', () => {
  it('is active under Vitest (MODE !== gas)', () => {
    expect(isLocalSpaDevMode()).toBe(import.meta.env.MODE !== 'gas')
    expect(isLocalSpaDevMode()).toBe(true)
  })

  it('mock auth accepts any non-empty credential', () => {
    const ok = mockAuthLoginV2Response('local-dev')
    expect(ok.authenticated).toBe(true)
    if (ok.authenticated) {
      expect(ok.user.id).toBe('local-dev')
      expect(ok.user.role).toBe('staff')
      expect(ok.capabilities.canAccessCalendar).toBe(true)
      expect(ok.capabilities.canAccessActa).toBe(true)
    }
  })

  it('authLogin via transport mock succeeds without google.script.run', async () => {
    const result = await authLogin({ credential: 'qa-test' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.role).toBe('staff')
      expect(result.data.capabilities.canAccessMenu).toBe(true)
    }
  })

  it('calendarService.getMatches returns sample rows in local dev', async () => {
    const data = await calendarService.getMatches({ categoria: 'M', fase: 'Fase I' })
    expect(data.schemaVersion).toBe(2)
    const matches = Object.values(data.matchesByEncuentroId)
    expect(matches.length).toBeGreaterThan(0)
    expect(matches.some((m) => m.estadoPartido === 'acta_abierta')).toBe(true)
  })

  it('gasTransport does not require google.script.run in local dev', async () => {
    const raw: { version: number; authenticated: boolean } = await gasTransport.call(
      'auth_login_v2',
      'x',
    )
    expect(raw.version).toBe(2)
    expect(raw.authenticated).toBe(true)
  })
})
