import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MatchStaleDocumentBanner } from '../components/MatchStaleDocumentBanner'
import { MatchSupersededBanner } from '../components/MatchSupersededBanner'
import { DocumentOperationalBanner } from '../components/DocumentOperationalBanner'
import {
  buildConcurrentUxCopy,
  buildRecoveryUxCopy,
  buildStaleUxCopy,
  buildSupersededUxCopy,
} from '../ux/uxOperationalMessages'
import { logUxOperational } from '../ux/uxOperationalLogger'
import { listHumanOperationalScenarios } from '../tools/humanOperationalScenarios'
import { matchReportReducer } from '../reducers/matchReportReducer'
import { matchReportInitialState } from '../reducers/matchReportInitialState'
import {
  selectEffectiveReadOnly,
  selectIsDocumentallyBlocked,
} from '../selectors/matchReportDocumentSelectors'
import { selectCanAttemptSave } from '../selectors/matchReportValidationUxSelectors'
import { emptyMatchReport, loadReportResponse, minimalDocumentRuntime } from './fixtures'

describe('A5 uxOperationalMessages', () => {
  it('buildStaleUxCopy incluye detalle humano', () => {
    const copy = buildStaleUxCopy({ kinds: ['WORKSPACE_SUPERSEDED'] })
    expect(copy.title).toMatch(/desactualizados/i)
    expect(copy.body).toMatch(/invalidada|reabierta/i)
  })

  it('buildSupersededUxCopy es accionable', () => {
    const copy = buildSupersededUxCopy()
    expect(copy.hint).toMatch(/Recargue/i)
  })

  it('buildConcurrentUxCopy define acción de reload', () => {
    const copy = buildConcurrentUxCopy()
    expect(copy.action).toMatch(/Recargar/i)
  })

  it('buildRecoveryUxCopy respeta preserveDirty', () => {
    const copy = buildRecoveryUxCopy({ shouldReload: true, preserveDirty: true })
    expect(copy.body).toMatch(/conservan/i)
  })
})

describe('A5 operational banners (SSR)', () => {
  it('MatchStaleDocumentBanner visible con stale', () => {
    const html = renderToStaticMarkup(
      createElement(MatchStaleDocumentBanner, {
        stale: { isStale: true, kinds: ['ALIGNMENT_STALE_SNAPSHOT'], findings: [], staleGraph: null },
        onReload: () => {},
      }),
    )
    expect(html).toContain('data-testid="match-stale-banner"')
    expect(html).toContain('Recargar desde Workspace')
  })

  it('MatchStaleDocumentBanner oculto sin stale ni concurrent', () => {
    const html = renderToStaticMarkup(
      createElement(MatchStaleDocumentBanner, { stale: { isStale: false, kinds: [], findings: [], staleGraph: null } }),
    )
    expect(html).toBe('')
  })

  it('MatchSupersededBanner visible cuando open', () => {
    const html = renderToStaticMarkup(
      createElement(MatchSupersededBanner, { open: true, onReload: () => {} }),
    )
    expect(html).toContain('data-testid="match-superseded-banner"')
    expect(html).toContain('invalidada')
  })

  it('DocumentOperationalBanner renderiza hint y acciones', () => {
    const html = renderToStaticMarkup(
      createElement(DocumentOperationalBanner, {
        tone: 'sky',
        title: 'T',
        body: 'B',
        hint: 'H',
        testId: 'test-banner',
        primaryAction: { label: 'OK', onClick: () => {} },
      }),
    )
    expect(html).toContain('data-testid="test-banner"')
    expect(html).toContain('H')
  })
})

describe('A5 document blocking selectors', () => {
  it('selectIsDocumentallyBlocked con superseded', () => {
    const report = emptyMatchReport()
    const document = minimalDocumentRuntime(report.context.encuentroId, {
      superseded: { isSuperseded: true, actaBinding: 'SUPERSEDED' },
    })
    const state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report, { document }) },
    })
    expect(selectIsDocumentallyBlocked(state)).toBe(true)
    expect(selectCanAttemptSave(state)).toBe(false)
  })

  it('selectEffectiveReadOnly combina report y documental', () => {
    const report = emptyMatchReport()
    const state = matchReportReducer(matchReportInitialState, {
      type: 'LOAD_REPORT_SUCCESS',
      payload: { response: loadReportResponse(report) },
    })
    expect(selectEffectiveReadOnly(state, false)).toBe(false)
    expect(selectEffectiveReadOnly(state, true)).toBe(true)
  })
})

describe('A5 humanOperationalScenarios', () => {
  it('lista escenarios para smoke manual', () => {
    const scenarios = listHumanOperationalScenarios()
    expect(scenarios.length).toBeGreaterThanOrEqual(4)
    expect(scenarios.some((s) => s.persona === 'doble_sesion')).toBe(true)
  })
})

describe('A5 uxOperationalLogger', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_RUNTIME_PROFILE', 'staging-gas')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('logUxOperational no lanza en staging', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    logUxOperational('STALE', 'test.event', { matchId: 'm1' })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
