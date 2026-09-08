import {
  devFixtureBlockedApps,
  devFixtureRules,
  devFixtureStats,
  devFixturesEnabled,
  devFixtureToday,
  resetDevFixtures,
  setDevFixturesEnabled,
} from '@/features/blocking/dev-fixtures'
import {
  computeRecordStreak,
  computeStreak,
} from '@/features/blocking/services/stats/stats.service'
import type { BlockRuleView } from '@/features/blocking/types'
import { translate } from '@/i18n/translate'

describe('dev fixtures switch', () => {
  afterEach(() => setDevFixturesEnabled(false))

  it('is off until it is explicitly turned on', () => {
    expect(devFixturesEnabled()).toBe(false)
    setDevFixturesEnabled(true)
    expect(devFixturesEnabled()).toBe(true)
  })
})

describe('fixture history', () => {
  it('reaches today and never goes past it', () => {
    const rows = devFixtureStats()
    expect(rows[0].date).toBe(devFixtureToday()?.date)
    expect(rows[0].date >= rows[1].date).toBe(true)
  })

  it('keeps the same numbers when read twice', () => {
    expect(devFixtureStats(10)).toEqual(devFixtureStats(10))
  })

  /**
   * Une série égale au record ne prouve rien : c'est le cas trivial. Les
   * trous du jeu de test existent pour que l'écran de détail du score ait
   * deux nombres DIFFÉRENTS à comparer.
   */
  it('breaks the streak somewhere, so the record stays above it', () => {
    const rows = devFixtureStats()
    expect(computeStreak(rows)).toBeGreaterThan(0)
    expect(computeRecordStreak(rows)).toBeGreaterThan(computeStreak(rows))
  })
})

describe('fixture rule store', () => {
  beforeEach(() => resetDevFixtures())

  it('seeds one rule per blocking mechanic', async () => {
    const rules = await devFixtureRules.list()
    expect(rules.map(rule => rule.type).sort()).toEqual([
      'daily_limit',
      'progressive_delay',
      'schedule',
    ])
  })

  /**
   * Ces règles servent à juger l'app — et à la capturer pour l'App Store.
   * Un nom d'emprunt (« [TEST] … ») y serait visible sur les captures ; le
   * titre doit donc venir du catalogue de préréglages du produit, dans la
   * langue affichée au moment de la lecture.
   */
  it('names rules with the product catalogue, never with a test marker', async () => {
    const names = (await devFixtureRules.list()).map(rule => rule.config?.name)
    expect(names).toEqual([
      translate('blocking.presets.nuit.title'),
      translate('blocking.presets.dose.title'),
      translate('blocking.presets.focus.title'),
    ])
    expect(names.some(name => String(name).includes('TEST'))).toBe(false)
  })

  /**
   * La seule règle « en cours » du jeu expirait au bout d'une heure — le
   * ménage automatique la supprimait et l'Accueil perdait sa carte de
   * protection active, précisément au moment de la capture.
   */
  it('keeps the timed block running, but not once it is paused', async () => {
    const running = (await devFixtureRules.list()).find(
      rule => rule.id === 'dev-fixture-timed',
    ) as BlockRuleView
    const endsAt = new Date(running.createdAt ?? 0).getTime() + 60 * 60_000
    expect(endsAt).toBeGreaterThan(Date.now())

    await devFixtureRules.suspend('dev-fixture-timed', null)
    const paused = (await devFixtureRules.list()).find(
      rule => rule.id === 'dev-fixture-timed',
    ) as BlockRuleView
    const pausedAgain = (await devFixtureRules.list()).find(
      rule => rule.id === 'dev-fixture-timed',
    ) as BlockRuleView

    /*
      Ce qui est vraiment en jeu : une règle en PAUSE cesse d'être rafraîchie.
      Deux lectures de suite doivent donc rendre la même date.

      La version précédente comparait `paused.createdAt` à `running.createdAt`
      avec un `toBe`. C'était intermittent, et pour une raison de fond, pas de
      bruit : tant que la règle est active, `decorate()` recalcule
      `minutesAgo(18)` à CHAQUE lecture. Les deux valeurs comparées étaient
      donc deux échantillons de `Date.now()` pris à des instants différents —
      égaux seulement quand ils tombaient dans la même milliseconde. Une
      assertion qui passe la plupart du temps et casse la CI de temps en temps
      est pire qu'une assertion absente : on apprend à la relancer.
    */
    expect(pausedAgain.createdAt).toBe(paused.createdAt)
    expect(
      Math.abs(
        new Date(paused.createdAt ?? 0).getTime() -
          new Date(running.createdAt ?? 0).getTime(),
      ),
    ).toBeLessThan(2000)
  })

  it('suspends and resumes without losing the rest of the config', async () => {
    const until = new Date('2026-09-08T10:00:00.000Z')
    await devFixtureRules.suspend('dev-fixture-schedule', until)
    let rule = (await devFixtureRules.list()).find(
      r => r.id === 'dev-fixture-schedule',
    ) as BlockRuleView
    expect(rule.isActive).toBe(false)
    expect(rule.config?.suspended_until).toBe(until.toISOString())
    expect(rule.config?.start_hour).toBe(22)

    await devFixtureRules.resume('dev-fixture-schedule')
    rule = (await devFixtureRules.list()).find(
      r => r.id === 'dev-fixture-schedule',
    ) as BlockRuleView
    expect(rule.isActive).toBe(true)
    expect(rule.config?.suspended_until).toBeUndefined()
    expect(rule.config?.start_hour).toBe(22)
  })

  it('creates and removes rules', async () => {
    const created = await devFixtureRules.create({
      id: 'test-rule',
      type: 'progressive_delay',
      appIds: [],
      count: 2,
      config: { duration_min: 15 },
    })
    expect(created.isActive).toBe(true)
    expect(await devFixtureRules.list()).toHaveLength(4)

    await devFixtureRules.remove('test-rule')
    expect(
      (await devFixtureRules.list()).some(rule => rule.id === 'test-rule'),
    ).toBe(false)
  })
})

describe('fixture blocked apps', () => {
  const rule = (id: string, count: number): BlockRuleView => ({
    id,
    type: 'schedule',
    appIds: [],
    isActive: true,
    count,
  })

  /** Une app visée par deux règles reste UNE app — cf. `mergeBlockedApps`. */
  it('dedupes apps covered by several rules', () => {
    const apps = devFixtureBlockedApps([rule('a', 3), rule('b', 2)])
    expect(apps).toHaveLength(3)
    expect(apps[0].ruleIds).toEqual(['a', 'b'])
    expect(apps[2].ruleIds).toEqual(['a'])
    expect(apps.every(app => !app.unlocked)).toBe(true)
  })

  it('returns nothing when no rule is running', () => {
    expect(devFixtureBlockedApps([])).toEqual([])
  })
})
