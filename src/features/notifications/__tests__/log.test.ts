/**
 * Instrumentation.
 *
 * Sans raison de suppression nommée, « pourquoi `retention.streak_at_risk`
 * n'est-elle pas partie hier soir ? » est une enquête d'une heure dans six
 * fichiers. Avec, c'est une ligne à lire.
 */
import { constants } from '@/config/constants'
import {
  clearNotifLog,
  lastDecisionFor,
  logNotifEvent,
  logNotifEvents,
  readNotifLog,
  suppressionBreakdown,
} from '@/features/notifications/engine/log'
import { NOW } from '@/features/notifications/notif-test-fixtures'
import { kvStorage } from '@/shared/services/storage/mmkv'

beforeEach(() => clearNotifLog())

it('répond à « pourquoi ce nœud n’est-il pas parti ? »', () => {
  logNotifEvents([
    {
      t: NOW,
      k: 'suppressed',
      n: 'retention.streak_at_risk',
      f: 'retention',
      reason: 'quiet_hours',
    },
    { t: NOW + 1, k: 'scheduled', n: 'progress.weekly_recap', f: 'progress' },
  ])
  expect(lastDecisionFor('retention.streak_at_risk')).toMatchObject({
    k: 'suppressed',
    reason: 'quiet_hours',
  })
})

it('agrège les refus par raison sur une fenêtre', () => {
  logNotifEvents([
    {
      t: NOW,
      k: 'suppressed',
      n: 'a.x',
      f: 'blocking',
      reason: 'budget_daily',
    },
    {
      t: NOW,
      k: 'suppressed',
      n: 'b.x',
      f: 'blocking',
      reason: 'budget_daily',
    },
    { t: NOW, k: 'suppressed', n: 'c.x', f: 'blocking', reason: 'cooldown' },
    // Hors fenêtre : ne doit pas compter.
    {
      t: NOW - 10 * 86_400_000,
      k: 'suppressed',
      n: 'd.x',
      f: 'blocking',
      reason: 'capacity',
    },
  ])
  expect(suppressionBreakdown(NOW, 7 * 86_400_000)).toEqual({
    budget_daily: 2,
    cooldown: 1,
  })
})

it('reste borné — un journal qui grossit sans lecteur est une fuite', () => {
  for (let i = 0; i < 260; i += 1) {
    logNotifEvent({
      t: NOW + i,
      k: 'scheduled',
      n: `blocking.n${i}`,
      f: 'blocking',
    })
  }
  const log = readNotifLog()
  expect(log).toHaveLength(200)
  // Ce sont les PLUS RÉCENTES qu'on garde.
  expect(log[log.length - 1].n).toBe('blocking.n259')
})

it('survit à un journal corrompu plutôt que de faire tomber le moteur', () => {
  kvStorage.setString(constants.NOTIF_LOG, '{ pas du json')
  expect(readNotifLog()).toEqual([])
})
