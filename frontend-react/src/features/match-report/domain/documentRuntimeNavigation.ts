/**
 * A5 — Limpieza de cache documental al cambiar de encuentro (evita stale visual residual).
 */

import {
  clearDocumentRuntimeStore,
  getDocumentRuntimeEntry,
} from './documentRuntimeStore'
import { logUxOperational } from '../ux/uxOperationalLogger'

export function prepareDocumentRuntimeForEncounter(matchId: string, previousMatchId?: string | null): void {
  const cached = getDocumentRuntimeEntry()
  if (cached && cached.matchId !== matchId) {
    clearDocumentRuntimeStore()
    logUxOperational('STALE', 'navigation.cacheCleared', {
      from: previousMatchId ?? cached.matchId,
      to: matchId,
    })
  }
}
