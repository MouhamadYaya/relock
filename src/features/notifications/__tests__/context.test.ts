/**
 * Construction du contexte, sur une installation FRAÎCHE.
 *
 * C'est la pièce la plus exposée du moteur : elle est la seule à toucher le
 * natif, le cache et MMKV, et elle s'exécute au tout premier démarrage, quand
 * absolument rien n'existe encore. Un `undefined` mal gardé ici fait tomber le
 * premier lancement de l'app — le seul moment où personne ne pardonne.
 */
jest.mock('@/shared/native/notifications', () => ({
  isNotifAvailable: true,
  Notif: {
    isAvailable: true,
    hasRoutingSupport: true,
    permissionStatus: jest.fn().mockResolvedValue('granted'),
  },
}))

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    isAvailable: true,
    authorizationStatus: jest.fn().mockResolvedValue('approved'),
    getDiagnostics: jest.fn().mockResolvedValue(null),
    limitSteps: jest.fn().mockResolvedValue({}),
  },
}))

import { buildNotifContext } from '@/features/notifications/engine/context'
import { clearSignals } from '@/features/notifications/engine/signals'
import { NOW } from '@/features/notifications/notif-test-fixtures'

beforeEach(() => clearSignals())

const fresh = () =>
  buildNotifContext({
    now: NOW,
    userActive: false,
    rules: null,
    stats: null,
    entitled: false,
  })

it('se construit sans règles, sans statistiques et sans diagnostic', async () => {
  const ctx = await fresh()
  expect(ctx.blocking.rulesCount).toBe(0)
  expect(ctx.results.streak).toBe(0)
  expect(ctx.score.status).toBe('pending')
  expect(ctx.billing.entitled).toBe(false)
})

it('ne crie PAS à la désynchronisation quand le natif est muet', async () => {
  // Diagnostic absent ⇒ on ne sait rien, et « on ne sait rien » n'est pas
  // « les protections sont tombées ». Accuser à vide ferait exactement le
  // contraire de ce que cette famille est censée apporter.
  const ctx = await fresh()
  expect(ctx.health.desyncCount).toBe(0)
  expect(ctx.health.extensionLastSeenAt).toBeNull()
})

it('n’invente pas de score tant que l’Accueil n’en a pas publié', async () => {
  const ctx = await fresh()
  expect(ctx.score.global).toBeNull()
  expect(ctx.score.bandRank).toBeNull()
})

it('accepte un score publié par l’Accueil', async () => {
  const ctx = await buildNotifContext({
    now: NOW,
    userActive: true,
    rules: null,
    stats: null,
    entitled: true,
    score: {
      status: 'ready',
      global: 72,
      focus: 70,
      rest: 74,
      delta: 6,
      weakestAxis: 'focus',
      historyDays: 14,
      confidence: 1,
      components: [],
    } as never,
  })
  expect(ctx.score.global).toBe(72)
  // 72 tombe dans la troisième bande (60–79).
  expect(ctx.score.bandRank).toBe(2)
  expect(ctx.userActive).toBe(true)
})
