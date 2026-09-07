/**
 * Le planner — c'est ici que se vérifient les décisions qui coûtent cher.
 */
import { planNotifications } from '@/features/notifications/engine/planner'
import { weekKey } from '@/features/notifications/engine/state'
import {
  context,
  DAY,
  HOUR,
  idsOf,
  NOW,
  node,
  prefs,
  reasonFor,
  state,
} from '@/features/notifications/notif-test-fixtures'
import type { NotifDefinition } from '@/features/notifications/types'

const plan = (catalog: NotifDefinition[], ctx = context(), st = state()) =>
  planNotifications({ ctx, state: st, catalog, foreignPending: 0 })

describe('files roulante et d’ancrage', () => {
  /**
   * LE bug d'architecture de la v1, en un test.
   *
   * Un horizon roulant de 7 jours ne peut par construction jamais écrire un tir
   * à J+14 : personne n'est là pour le programmer le jour où il entrerait dans
   * la fenêtre. L'utilisateur qui ne revient jamais ne reçoit donc jamais rien.
   */
  it('refuse un nœud ROULANT dont le tir est hors horizon', () => {
    const far = node({
      id: 'retention.absent_14d',
      family: 'retention',
      scheduling: 'rolling',
      schedule: ctx => ({ kind: 'absolute', at: ctx.now + 14 * DAY }),
    })
    const result = plan([far])

    expect(result.rolling).toHaveLength(0)
    expect(reasonFor(result.suppressed, 'retention.absent_14d')).toBe(
      'outside_horizon',
    )
  })

  it('écrit le MÊME tir quand il est déclaré en file d’ancrage', () => {
    const anchored = node({
      id: 'retention.absent_14d',
      family: 'retention',
      scheduling: 'anchor',
      schedule: ctx => ({ kind: 'absolute', at: ctx.now + 14 * DAY }),
    })
    const result = plan([anchored])

    expect(idsOf(result.anchors)).toEqual(['retention.absent_14d'])
    expect(result.anchors[0].schedule.at).toBe(NOW + 14 * DAY)
  })

  it('écrit une fin d’essai lointaine, que le roulant ne verrait jamais', () => {
    const trial = node({
      id: 'billing.trial_ends_2d',
      family: 'billing',
      channel: 'account',
      scheduling: 'anchor',
      schedule: ctx => ({ kind: 'absolute', at: ctx.now + 28 * DAY }),
    })
    expect(idsOf(plan([trial]).anchors)).toEqual(['billing.trial_ends_2d'])
  })
})

describe('budget', () => {
  /**
   * Le cas ambigu, tranché : protection hors budget, et UN seul créneau
   * standard pour la journée, pris par la priorité la plus haute.
   */
  it('laisse passer la protection et un seul message standard', () => {
    const catalog = [
      node({ id: 'progress.first_win', family: 'progress', priority: 90 }),
      node({
        id: 'activation.selection_empty',
        family: 'activation',
        priority: 88,
      }),
      node({
        id: 'health.rules_desync',
        family: 'health',
        channel: 'protection',
        priority: 95,
      }),
      node({
        id: 'billing.trial_ends_2d',
        family: 'billing',
        channel: 'account',
        priority: 80,
      }),
    ]
    const result = plan(catalog)

    expect(idsOf(result.rolling).sort()).toEqual([
      'health.rules_desync',
      'progress.first_win',
    ])
    expect(reasonFor(result.suppressed, 'activation.selection_empty')).toBe(
      'budget_daily',
    )
    expect(reasonFor(result.suppressed, 'billing.trial_ends_2d')).toBe(
      'budget_daily',
    )
  })

  it('compte le budget par JOUR, pas sur la semaine entière', () => {
    // Deux tirs, deux jours différents : les deux passent.
    const catalog = [
      node({
        id: 'blocking.a',
        schedule: ctx => ({ kind: 'absolute', at: ctx.now + 2 * HOUR }),
      }),
      node({
        id: 'blocking.b',
        schedule: ctx => ({ kind: 'absolute', at: ctx.now + DAY + 2 * HOUR }),
      }),
    ]
    expect(idsOf(plan(catalog).rolling).sort()).toEqual([
      'blocking.a',
      'blocking.b',
    ])
  })

  it('applique le quota hebdomadaire au-delà du quota journalier', () => {
    const catalog = Array.from({ length: 7 }, (_, index) =>
      node({
        id: `blocking.day_${index}`,
        schedule: ctx => ({
          kind: 'absolute',
          at: ctx.now + index * DAY + 2 * HOUR,
        }),
      }),
    )
    const result = plan(catalog)
    expect(result.rolling).toHaveLength(5)
    expect(
      result.suppressed.filter(entry => entry.reason === 'budget_weekly'),
    ).toHaveLength(2)
  })

  /**
   * « Cinq messages par semaine » n'a jamais voulu dire « cinq fois le même
   * message ». Sans ce quota par nœud, `maxPerWeek` serait décoratif.
   */
  it('applique le quota HEBDOMADAIRE propre à chaque nœud', () => {
    const definition = node({
      id: 'blocking.repeat',
      maxPerWeek: 2,
      schedule: ctx => ({ kind: 'absolute', at: ctx.now + 2 * HOUR }),
    })
    const st = state({
      sentPerWeek: { [`${weekKey(NOW)}|blocking.repeat`]: 2 },
    })
    expect(
      reasonFor(
        plan([definition], context(), st).suppressed,
        'blocking.repeat',
      ),
    ).toBe('budget_weekly')
  })

  it('divise ce quota quand la famille est fatiguée', () => {
    const definition = node({
      id: 'blocking.repeat',
      maxPerWeek: 4,
      schedule: ctx => ({ kind: 'absolute', at: ctx.now + 2 * HOUR }),
    })
    const sent = { [`${weekKey(NOW)}|blocking.repeat`]: 2 }

    expect(
      plan([definition], context(), state({ sentPerWeek: sent })).rolling,
    ).toHaveLength(1)
    // Fatiguée ⇒ quota ramené de 4 à 2 ⇒ déjà atteint.
    const tired = state({ sentPerWeek: sent, fatigue: { blocking: -6 } })
    expect(plan([definition], context(), tired).rolling).toHaveLength(0)
  })

  it('donne au rituel son propre budget, distinct du standard', () => {
    const catalog = [
      node({ id: 'blocking.standard', priority: 90 }),
      node({
        id: 'ritual.my_moment',
        family: 'ritual',
        channel: 'ritual',
        priority: 40,
      }),
    ]
    const ctx = context({
      prefs: prefs({
        channels: {
          reminders: true,
          progression: true,
          account: true,
          offers: false,
          ritual: true,
        },
      }),
    })
    // Ce que l'utilisateur a demandé lui-même ne consomme pas le budget des
    // messages qu'on envoie de notre propre initiative.
    expect(idsOf(plan(catalog, ctx).rolling).sort()).toEqual([
      'blocking.standard',
      'ritual.my_moment',
    ])
  })
})

describe('supersession', () => {
  it('ne garde qu’un nœud par groupe exclusif, le plus prioritaire', () => {
    const catalog = [
      node({
        id: 'progress.weekly_recap',
        family: 'progress',
        priority: 60,
        exclusiveGroup: 'digest',
      }),
      node({
        id: 'progress.personal_best',
        family: 'progress',
        priority: 65,
        exclusiveGroup: 'digest',
      }),
    ]
    const result = plan(catalog)
    expect(idsOf(result.rolling)).toEqual(['progress.personal_best'])
    expect(reasonFor(result.suppressed, 'progress.weekly_recap')).toBe(
      'exclusive_group',
    )
  })

  it('absorbe explicitement un nœud du même jour et compte le groupe', () => {
    const catalog = [
      node({ id: 'progress.weekly_recap', family: 'progress', priority: 60 }),
      node({
        id: 'progress.personal_best',
        family: 'progress',
        priority: 65,
        supersedes: ['progress.weekly_recap'],
        content: (_ctx, meta) => ({
          titleKey: `merged.${meta.groupSize}`,
          bodyKey: 'body',
        }),
      }),
    ]
    const result = plan(catalog)
    expect(idsOf(result.rolling)).toEqual(['progress.personal_best'])
    expect(reasonFor(result.suppressed, 'progress.weekly_recap')).toBe(
      'superseded',
    )
    // Le vainqueur SAIT ce qu'il absorbe : c'est ce qui lui permet de composer
    // un message unique au lieu d'en répéter deux.
    expect(result.rolling[0].content.titleKey).toBe('merged.2')
  })

  it('n’absorbe pas un nœud prévu un autre jour', () => {
    const catalog = [
      node({
        id: 'progress.weekly_recap',
        family: 'progress',
        priority: 60,
        schedule: ctx => ({ kind: 'absolute', at: ctx.now + 3 * DAY }),
      }),
      node({
        id: 'progress.personal_best',
        family: 'progress',
        priority: 65,
        supersedes: ['progress.weekly_recap'],
      }),
    ]
    expect(idsOf(plan(catalog).rolling).sort()).toEqual([
      'progress.personal_best',
      'progress.weekly_recap',
    ])
  })

  it('réduit un incident de protection à UNE seule notification', () => {
    const incident = (id: string, priority: number) =>
      node({
        id,
        family: 'health',
        channel: 'protection',
        priority,
        exclusiveGroup: 'health.incident',
        content: (_ctx, meta) => ({
          titleKey:
            meta.groupSize > 1 ? 'health.incident.title' : `${id}.title`,
          bodyKey: 'body',
        }),
      })
    const result = plan([
      incident('health.screen_time_revoked', 100),
      incident('health.rules_desync', 95),
      incident('health.selection_drift', 85),
    ])

    expect(result.rolling).toHaveLength(1)
    // Trois symptômes d'une même panne : on dit la CONSÉQUENCE, pas trois causes.
    expect(result.rolling[0].content.titleKey).toBe('health.incident.title')
  })
})

describe('heures calmes', () => {
  it('décale un tir de nuit à la sortie de fenêtre, sans le supprimer', () => {
    const nightly = node({
      id: 'blocking.night',
      schedule: ctx => ({ kind: 'absolute', at: ctx.now + 14 * HOUR }), // 23h
    })
    const result = plan([nightly])
    const at = new Date(result.rolling[0].schedule.at)
    expect(at.getHours()).toBe(8)
    expect(at.getDate()).toBe(14)
  })

  it('respecte une fenêtre personnalisée QUI REMPLACE la valeur par défaut', () => {
    // 22h30 est dans le défaut (22h–8h) mais hors de 23h–7h : avec un réglage
    // qui remplace, le tir ne doit pas bouger. S'il bougeait, choisir sa
    // fenêtre ne servirait à rien.
    const ctx = context({
      prefs: prefs({
        quietHours: { startMinutes: 23 * 60, endMinutes: 7 * 60 },
      }),
    })
    const nightly = node({
      id: 'blocking.late',
      schedule: c => ({ kind: 'absolute', at: c.now + 13.5 * HOUR }),
    })
    const result = plan([nightly], ctx)
    expect(new Date(result.rolling[0].schedule.at).getHours()).toBe(22)
  })

  it('ne décale jamais un nœud dont l’instant EST le message', () => {
    const unlock = node({
      id: 'strict.unlock_available',
      family: 'strict',
      quietHours: 'ignore',
      schedule: ctx => ({ kind: 'absolute', at: ctx.now + 14 * HOUR }),
    })
    expect(new Date(plan([unlock]).rolling[0].schedule.at).getHours()).toBe(23)
  })
})

describe('canaux et permissions', () => {
  it('coupe tout sauf la protection quand l’interrupteur maître est éteint', () => {
    const catalog = [
      node({ id: 'blocking.reminder' }),
      node({
        id: 'health.rules_desync',
        family: 'health',
        channel: 'protection',
      }),
    ]
    const ctx = context({ prefs: prefs({ master: false }) })
    const result = plan(catalog, ctx)

    expect(idsOf(result.rolling)).toEqual(['health.rules_desync'])
    expect(reasonFor(result.suppressed, 'blocking.reminder')).toBe('master_off')
  })

  it('refuse le promotionnel tant que le canal offres n’est pas accepté', () => {
    const offer = node({
      id: 'billing.offer_available',
      family: 'billing',
      channel: 'offers',
    })
    expect(reasonFor(plan([offer]).suppressed, 'billing.offer_available')).toBe(
      'channel_off',
    )
  })

  it('ne planifie rien sans autorisation système', () => {
    const ctx = context({ permission: 'denied' })
    expect(
      reasonFor(plan([node()], ctx).suppressed, 'blocking.test_node'),
    ).toBe('permission')
  })
})

describe('détectabilité', () => {
  it('refuse un nœud de protection dont l’observateur n’est pas vérifié', () => {
    const unverified = node({
      id: 'health.selection_drift',
      family: 'health',
      channel: 'protection',
      detectability: {
        offlineSignal: 'unverified',
        observer: 'app',
        firesWithoutReopen: false,
        note: 'non tranché',
      },
    })
    expect(
      reasonFor(plan([unverified]).suppressed, 'health.selection_drift'),
    ).toBe('detectability')
  })
})

describe('événement produit contre notification', () => {
  it('affiche in-app plutôt que de notifier quelqu’un qui a l’app ouverte', () => {
    const adaptive = node({
      id: 'billing.renewal_failed',
      delivery: 'adaptive',
    })
    const result = plan([adaptive], context({ userActive: true }))

    expect(result.rolling).toHaveLength(0)
    expect(result.inApp.map(intent => intent.definition.id)).toEqual([
      'billing.renewal_failed',
    ])
  })

  it('notifie quand l’utilisateur est parti sans régler le problème', () => {
    const adaptive = node({
      id: 'billing.renewal_failed',
      delivery: 'adaptive',
    })
    expect(idsOf(plan([adaptive]).rolling)).toEqual(['billing.renewal_failed'])
  })

  it('laisse un délai de grâce après une présentation in-app', () => {
    const adaptive = node({
      id: 'billing.renewal_failed',
      delivery: 'adaptive',
      adaptiveDeferMs: 6 * HOUR,
    })
    const st = state({ inAppAt: { 'billing.renewal_failed': NOW - HOUR } })
    expect(
      reasonFor(
        plan([adaptive], context(), st).suppressed,
        'billing.renewal_failed',
      ),
    ).toBe('delivered_in_app')
  })

  it('ne planifie jamais ce que l’extension émet elle-même', () => {
    const external = node({
      id: 'progress.first_resist',
      family: 'progress',
      emitter: 'shieldExtension',
    })
    expect(
      reasonFor(plan([external]).suppressed, 'progress.first_resist'),
    ).toBe('external_emitter')
  })
})

describe('capacité', () => {
  it('protège les ancres et sacrifie le roulant quand la file sature', () => {
    const rolling = Array.from({ length: 40 }, (_, index) =>
      node({
        id: `blocking.r_${index}`,
        family: 'ritual',
        channel: 'ritual',
        budget: 'userRequested',
        schedule: ctx => ({
          kind: 'absolute',
          at: ctx.now + index * HOUR + HOUR,
        }),
      }),
    )
    const anchors = Array.from({ length: 3 }, (_, index) =>
      node({
        id: `billing.anchor_${index}`,
        family: 'billing',
        channel: 'account',
        scheduling: 'anchor',
        schedule: ctx => ({ kind: 'absolute', at: ctx.now + 10 * DAY }),
      }),
    )
    const ctx = context({
      prefs: prefs({
        channels: {
          reminders: true,
          progression: true,
          account: true,
          offers: false,
          ritual: true,
        },
      }),
    })
    // 44 créneaux déjà pris par d'autres : il n'en reste que 4 sous le plafond
    // doux, et ce sont les ancres qui doivent les avoir.
    const result = planNotifications({
      ctx,
      state: state(),
      catalog: [...rolling, ...anchors],
      foreignPending: 44,
    })

    expect(result.anchors).toHaveLength(3)
    expect(result.rolling).toHaveLength(1)
    expect(result.suppressed.some(entry => entry.reason === 'capacity')).toBe(
      true,
    )
  })
})
