/**
 * Invariants du catalogue. Ces règles doivent casser la CI, pas se découvrir
 * en production six semaines plus tard.
 */
import {
  catalogIntegrityIssues,
  enabledNodes,
  NOTIF_CATALOG,
} from '@/features/notifications/catalog'
import { CAPACITY } from '@/features/notifications/engine/capacity'
import { context } from '@/features/notifications/notif-test-fixtures'
import en from '@/i18n/locales/en.json'
import es from '@/i18n/locales/es.json'
import fr from '@/i18n/locales/fr.json'

it('respecte tous ses invariants', () => {
  expect(catalogIntegrityIssues()).toEqual([])
})

it('garde la rampe de lancement en dessous du catalogue complet', () => {
  // Livrer les 50 nœuds d'un coup ferait de Relock exactement ce contre quoi
  // Relock est vendu. Ce test protège la promesse produit, pas une métrique.
  expect(NOTIF_CATALOG.length).toBeGreaterThanOrEqual(50)
  // La fourchette annoncée au lancement. La faire monter est une décision
  // produit, pas un effet de bord d'un ajout au catalogue.
  expect(enabledNodes().length).toBeLessThanOrEqual(24)
})

it('réserve assez de créneaux pour toutes les ancres actives', () => {
  const anchors = enabledNodes().filter(node => node.scheduling === 'anchor')
  expect(anchors.length).toBeLessThanOrEqual(CAPACITY.anchorMax)
})

it('n’active aucune alerte de protection sans observateur vérifié', () => {
  for (const node of enabledNodes().filter(n => n.family === 'health')) {
    expect(node.detectability.offlineSignal).not.toBe('unverified')
  }
})

it('donne un repli à tout nœud qui vise un écran conditionnel', () => {
  // Ouvrir le paywall à quelqu'un qui vient de s'abonner est une panne visible,
  // et elle se produit précisément quand la notification a fait son travail.
  for (const node of NOTIF_CATALOG) {
    const pathname = node.route(context()).pathname
    if (
      pathname.startsWith('/paywall') ||
      pathname.startsWith('/block-editor')
    ) {
      expect(node.routeGuard).toBeDefined()
      expect(node.routeFallback).toBeDefined()
    }
  }
})

describe('traductions', () => {
  const LOCALES = { fr, en, es } as Record<string, Record<string, unknown>>

  const lookup = (bundle: Record<string, unknown>, key: string): unknown =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          typeof node === 'object' && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        bundle,
      )

  /**
   * Un nœud dont la clé n'existe pas n'échoue pas : i18next affiche la CLÉ
   * BRUTE dans la notification. « notifications.health.rules_desync.title »
   * sur l'écran verrouillé de quelqu'un dont les protections sont tombées.
   */
  it('couvre chaque nœud du catalogue dans les quatre langues', () => {
    const missing: string[] = []
    for (const node of NOTIF_CATALOG) {
      const spec = node.content(context(), { groupSize: 1, variant: null })
      const variants = node.variants ?? [null]
      for (const variant of variants) {
        const withVariant = node.content(context(), {
          groupSize: 1,
          variant: variant ?? null,
        })
        for (const [lang, bundle] of Object.entries(LOCALES)) {
          for (const key of [withVariant.titleKey, withVariant.bodyKey]) {
            if (typeof lookup(bundle, key) !== 'string') {
              missing.push(`${lang} · ${key}`)
            }
          }
        }
      }
      expect(typeof spec.titleKey).toBe('string')
    }
    expect(missing).toEqual([])
  })

  it('couvre aussi le message d’incident groupé de la protection', () => {
    for (const bundle of Object.values(LOCALES)) {
      expect(typeof lookup(bundle, 'notifications.health.incident.title')).toBe(
        'string',
      )
      expect(typeof lookup(bundle, 'notifications.health.incident.body')).toBe(
        'string',
      )
    }
  })
})
