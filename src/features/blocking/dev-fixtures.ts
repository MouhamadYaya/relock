/**
 * DEV uniquement — jeu de données FICTIVES pour travailler sur simulateur.
 *
 * Pourquoi : sur simulateur, Family Controls n'existe pas et le compte de dev
 * part vide. L'Accueil et les Blocages restent donc des écrans vides, sur
 * lesquels on ne peut juger ni la mise en page, ni les enchaînements, ni ce
 * que raconte un chiffre. Le rapport Temps d'écran, lui, a déjà son aperçu
 * fictif côté natif (`ScreenTimeReportView.swift`, `#if targetEnvironment
 * (simulator)`) : ce module complète ce qui vient du JS — série, règles,
 * minutes regagnées, apps sous protection.
 *
 * Trois garanties, dans cet ordre :
 *  1. `__DEV__` — aucun de ces chemins n'existe dans une build Release ;
 *  2. interrupteur explicite, ÉTEINT par défaut et persisté par installation
 *     (`relock://dev/fixtures/on`). Une build de dev sur ton iPhone continue
 *     donc d'afficher tes VRAIES données tant que tu ne l'allumes pas ;
 *  3. aucune écriture distante : tant qu'il est allumé, les services
 *     concernés ne touchent plus du tout à Supabase — ni lecture, ni écriture.
 *     Aucune donnée fictive ne peut donc atterrir dans un vrai compte.
 */

import { constants } from '@/config/constants'
import type { BlockedApp } from '@/features/blocking/hooks/useBlockedApps'
import {
  MIN_SAVED_PER_RESIST,
  ymd,
} from '@/features/blocking/services/stats/stats.service'
import type { BlockRuleView, CreateRuleInput } from '@/features/blocking/types'
import { translate } from '@/i18n/translate'
import { kvStorage } from '@/shared/services/storage/mmkv'
import type { DailyStats } from '@/shared/services/supabase/database.types'
import { genUUID } from '@/shared/utils/uuid'

/** Cache mémoire : le drapeau est relu à chaque appel de service. */
let enabled: boolean | null = null

/** L'interrupteur est-il allumé ? Toujours faux hors développement. */
export function devFixturesEnabled(): boolean {
  if (!__DEV__) return false
  if (enabled === null) {
    enabled = kvStorage.getString(constants.DEV_FIXTURES) === '1'
  }
  return enabled
}

/**
 * Allume ou éteint le jeu de test. Éteindre ne détruit PAS les règles
 * fictives : on peut faire un aller-retour sans tout re-semer.
 */
export function setDevFixturesEnabled(on: boolean): void {
  if (!__DEV__) return
  enabled = on
  kvStorage.setString(constants.DEV_FIXTURES, on ? '1' : '0')
}

/** Re-sème les règles fictives dans leur état d'origine. */
export function resetDevFixtures(): void {
  if (!__DEV__) return
  kvStorage.delete(constants.DEV_FIXTURE_RULES)
}

// ─── Statistiques ────────────────────────────────────────────────────────

/**
 * Valeur STABLE pour un jour donné. Un `Math.random()` ferait danser les
 * compteurs à chaque refetch (l'Accueil se rafraîchit toutes les 60 s) : on
 * ne saurait plus si un chiffre bouge parce que le code le fait bouger.
 */
function seeded(key: string, min: number, max: number): number {
  let hash = 7
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) % 1_000_003
  }
  return min + (hash % (max - min + 1))
}

/** Profondeur d'historique : de quoi remplir la série, le record et le graphe. */
const HISTORY_DAYS = 45

/**
 * Jours (en « il y a N jours ») SANS ligne : la chaîne s'y interrompt.
 * Sans eux, série courante et record seraient toujours égaux — et l'écran de
 * détail du score, qui compare les deux, ne se testerait jamais vraiment.
 */
const BROKEN_DAYS = new Set([11, 12, 26])

function fixtureDay(offset: number): DailyStats | null {
  if (BROKEN_DAYS.has(offset)) return null
  const date = new Date()
  date.setDate(date.getDate() - offset)
  const key = ymd(date)
  const stopped = seeded(`${key}:stopped`, 2, 14)
  return {
    id: `dev-fixture-${key}`,
    user_id: 'dev-fixture',
    date: key,
    interceptions_count: stopped + seeded(`${key}:intercept`, 0, 6),
    opens_stopped: stopped,
    time_saved_minutes: stopped * MIN_SAVED_PER_RESIST,
    streak_respected: true,
  }
}

/** Historique fictif, du plus récent au plus ancien (comme `recent()`). */
export function devFixtureStats(days = HISTORY_DAYS): DailyStats[] {
  const rows: DailyStats[] = []
  for (let offset = 0; offset < Math.min(days, HISTORY_DAYS); offset++) {
    const row = fixtureDay(offset)
    if (row) rows.push(row)
  }
  return rows
}

/** Ligne du jour, ou `null` — exactement ce que rend `StatsService.today()`. */
export function devFixtureToday(): DailyStats | null {
  return fixtureDay(0)
}

// ─── Règles de blocage ───────────────────────────────────────────────────

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

/**
 * Trois règles, une par mécanique, pour que chaque état de l'interface ait un
 * représentant : un blocage minuté EN COURS (carte « protection active » de
 * l'Accueil), une plage nocturne, une limite quotidienne.
 *
 * Les noms ne sont PAS écrits ici : on stocke le `preset_id` du produit et le
 * titre est résolu à la lecture, dans la langue courante — un jeu de données
 * semé en français resterait sinon en français sur des captures anglaises.
 */
function seedRules(): BlockRuleView[] {
  return [
    {
      id: 'dev-fixture-timed',
      type: 'progressive_delay',
      appIds: [],
      isActive: true,
      count: 4,
      config: { preset_id: 'focus', duration_min: 60, dev_rolling: true },
      createdAt: minutesAgo(18),
    },
    {
      id: 'dev-fixture-schedule',
      type: 'schedule',
      appIds: [],
      isActive: true,
      count: 6,
      config: {
        preset_id: 'nuit',
        start_hour: 22,
        start_minute: 0,
        end_hour: 8,
        end_minute: 0,
      },
      createdAt: minutesAgo(60 * 24 * 12),
    },
    {
      id: 'dev-fixture-limit',
      type: 'daily_limit',
      appIds: [],
      isActive: true,
      count: 3,
      config: { preset_id: 'dose', limit_min: 30 },
      createdAt: minutesAgo(60 * 24 * 5),
    },
  ]
}

/** Le titre du produit pour ce préréglage, dans la langue affichée. */
function presetTitle(presetId: unknown): string | null {
  if (typeof presetId !== 'string') return null
  return translate(`blocking.presets.${presetId}.title`)
}

/**
 * Ce que l'interface lira : le titre traduit maintenant, et un blocage minuté
 * qui n'est jamais échu.
 *
 * Sans ce dernier point, la seule règle « en cours » du jeu expirait au bout
 * d'une heure — le ménage automatique la supprimait, et l'Accueil perdait sa
 * carte de protection active au moment précis où l'on voulait la montrer. Une
 * règle mise en PAUSE, elle, n'est pas rafraîchie : c'est un état qu'on veut
 * pouvoir observer.
 */
function decorate(rule: BlockRuleView): BlockRuleView {
  const config = { ...(rule.config ?? {}) }
  const title = presetTitle(config.preset_id)
  if (title && typeof config.name !== 'string') config.name = title
  const rolling = config.dev_rolling === true && rule.isActive
  return {
    ...rule,
    config,
    createdAt: rolling ? minutesAgo(18) : rule.createdAt,
  }
}

function readRules(): BlockRuleView[] {
  const raw = kvStorage.getString(constants.DEV_FIXTURE_RULES)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as BlockRuleView[]
    } catch {
      // Contenu illisible (format changé entre deux versions) : on re-sème.
    }
  }
  const seeded = seedRules()
  writeRules(seeded)
  return seeded
}

function writeRules(rules: BlockRuleView[]): void {
  kvStorage.setString(constants.DEV_FIXTURE_RULES, JSON.stringify(rules))
}

function patch(id: string, change: (rule: BlockRuleView) => BlockRuleView) {
  writeRules(readRules().map(rule => (rule.id === id ? change(rule) : rule)))
}

/**
 * Magasin local qui reproduit `BlockRulesService`, méthode pour méthode.
 *
 * Il fallait bien plus qu'une liste en lecture seule : sans les écritures, la
 * moindre pause, prolongation ou suppression échouait contre Supabase, et
 * l'onglet Blocages devenait intestable — c'est-à-dire inutile.
 */
export const devFixtureRules = {
  async list(): Promise<BlockRuleView[]> {
    return readRules()
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
      .map(decorate)
  },

  async create(input: CreateRuleInput): Promise<BlockRuleView> {
    const rule: BlockRuleView = {
      id: input.id ?? genUUID(),
      type: input.type,
      appIds: input.appIds,
      isActive: true,
      count: input.count,
      config: input.config ?? {},
      createdAt: new Date().toISOString(),
    }
    writeRules([...readRules(), rule])
    return rule
  },

  async update(
    id: string,
    input: {
      type: BlockRuleView['type']
      count?: number
      config: Record<string, unknown>
    },
  ): Promise<void> {
    patch(id, rule => {
      const config: Record<string, unknown> = { ...input.config }
      // Même règle que côté Supabase : l'état de vie survit à l'édition.
      if (rule.config?.suspended_until != null) {
        config.suspended_until = rule.config.suspended_until
      }
      return {
        ...rule,
        type: input.type,
        count: input.count ?? rule.count,
        config,
      }
    })
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    patch(id, rule => ({ ...rule, isActive }))
  },

  async suspend(id: string, until: Date | null): Promise<void> {
    patch(id, rule => ({
      ...rule,
      isActive: false,
      config: {
        ...(rule.config ?? {}),
        suspended_until: until ? until.toISOString() : null,
      },
    }))
  },

  async resume(id: string): Promise<void> {
    patch(id, rule => {
      const config = { ...(rule.config ?? {}) }
      delete config.suspended_until
      return { ...rule, isActive: true, config }
    })
  },

  async extendTimedBlock(id: string, durationMin: number): Promise<void> {
    patch(id, rule => ({
      ...rule,
      config: { ...(rule.config ?? {}), duration_min: durationMin },
    }))
  },

  async remove(id: string): Promise<void> {
    writeRules(readRules().filter(rule => rule.id !== id))
  },
}

// ─── Apps sous protection ────────────────────────────────────────────────

/** Jetons fictifs. Aucune icône ne s'affichera : Apple ne les résoudra pas. */
const APP_KEYS = [
  'dev-app-1',
  'dev-app-2',
  'dev-app-3',
  'dev-app-4',
  'dev-app-5',
  'dev-app-6',
]

/**
 * Ce que `ScreenTime.blockedAppKeys()` rendrait : l'union DÉDUPLIQUÉE des
 * apps des règles en cours. Une app visée par deux règles reste une app —
 * c'est justement la propriété que la rangée « Mes apps » doit respecter.
 */
export function devFixtureBlockedApps(
  runningRules: BlockRuleView[],
): BlockedApp[] {
  const byKey = new Map<string, BlockedApp>()
  for (const rule of runningRules) {
    const keys = APP_KEYS.slice(0, rule.count ?? 3)
    for (const key of keys) {
      const existing = byKey.get(key)
      if (existing) existing.ruleIds.push(rule.id)
      else byKey.set(key, { key, unlocked: false, ruleIds: [rule.id] })
    }
  }
  return [...byKey.values()]
}
