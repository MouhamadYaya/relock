/**
 * Les deux phrases qui décrivent une règle de blocage : ce qu'elle EST
 * (`configLine`) et ce qu'elle FAIT en ce moment (`stateLine`).
 *
 * Elles vivaient dans `screens/BlocagesScreen.tsx`, dont le composant d'écran
 * n'était plus routé depuis le passage à `BlocagesV2Screen` : importer ces
 * deux fonctions traînait avec elles tout un écran mort — ses vues SVG, ses
 * styles, ses hooks de données. Elles n'ont jamais eu besoin d'un écran, et
 * `BlocagesV2Screen` comme `BlockDetailScreen` les appellent hors composant.
 *
 * D'où `translate` plutôt que `useT` : elles sont appelées depuis des
 * fonctions pures et depuis les tests, pas seulement pendant un rendu.
 */
import { durationLabel, hhmm } from '@/features/blocking/format'
import {
  daysLabel,
  type Indicator,
  type RuleSession,
  ruleDays,
  scheduleNextStart,
  suspendedUntil,
} from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { translate } from '@/i18n/translate'

const t = translate

const hhmmParts = (h: unknown, m: unknown) =>
  `${String(typeof h === 'number' ? h : 0).padStart(2, '0')}:${String(typeof m === 'number' ? m : 0).padStart(2, '0')}`

/**
 * Ce que le blocage EST — son type, puis ses réglages. Le titre ne suffit pas :
 * quelqu'un qui a créé un blocage par erreur doit pouvoir le reconnaître sans
 * l'ouvrir, et savoir ce qu'il a choisi.
 */
export function configLine(r: BlockRuleView): string {
  const c = (r.config ?? {}) as Record<string, unknown>
  const n = (v: unknown, d: number) => (typeof v === 'number' ? v : d)
  const apps =
    r.count && r.count > 0 ? t('blocking.app_count', { count: r.count }) : null
  if (r.type === 'progressive_delay') {
    return [
      t('blocking.rule_types.timed'),
      durationLabel(n(c.duration_min, 30) * 60_000),
      apps,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  if (r.type === 'daily_limit') {
    return [
      t('blocking.rule_types.limit'),
      t('blocking.per_day', {
        duration: durationLabel(n(c.limit_min, 60) * 60_000),
      }),
      apps,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return [
    t('blocking.rule_types.schedule'),
    `${hhmmParts(c.start_hour, c.start_minute)} → ${hhmmParts(c.end_hour, c.end_minute)}`,
    daysLabel(ruleDays(r)),
    apps,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Segments de la ligne d'état : le chiffre clé est colorisé séparément. */
export type StateLine = {
  pre?: string
  key?: string
  post?: string
  tone?: 'v' | 'a'
}

export function stateLine(s: RuleSession, now: Date): StateLine {
  const r = s.rule
  if (s.state === 'suspended') {
    const until = suspendedUntil(r)
    if (!until) return { pre: t('blocking.state_line.suspended_indefinite') }
    return {
      pre: t('blocking.state_line.resumes_in'),
      key: durationLabel(until.getTime() - now.getTime()),
      tone: 'a',
    }
  }

  if (r.type === 'progressive_delay' && s.sessionEndsAt) {
    return {
      pre: t('blocking.state_line.ends_at'),
      key: hhmm(s.sessionEndsAt),
      tone: 'v',
    }
  }

  if (r.type === 'daily_limit') {
    const ind = s.indicator as Extract<Indicator, { kind: 'limit' }>
    const limit = Number(r.config?.limit_min ?? 60)
    if (ind.reached)
      return { pre: t('blocking.state_line.limit_reached'), tone: 'a' }
    // Sans palier remonté par le natif, on ne prétend pas connaître la conso.
    if (ind.pct <= 0)
      return {
        pre: t('blocking.state_line.limit_of', {
          duration: durationLabel(limit * 60_000),
        }),
      }
    return {
      pre: '~',
      key: durationLabel(limit * (1 - ind.pct) * 60_000),
      post: t('blocking.state_line.left_today'),
      tone: 'v',
    }
  }

  // Plage horaire
  if (s.state === 'running' && s.sessionEndsAt) {
    return {
      pre: t('blocking.state_line.until'),
      key: hhmm(s.sessionEndsAt),
      post: t('blocking.state_line.still_left', {
        duration: durationLabel(s.sessionEndsAt.getTime() - now.getTime()),
      }),
      tone: 'v',
    }
  }
  const start = scheduleNextStart(r, now)
  const soon = start.getTime() - now.getTime() < 12 * 3_600_000
  return {
    pre: soon
      ? t('blocking.state_line.starts_at')
      : t('blocking.state_line.tomorrow_at'),
    key: hhmm(start),
    post: soon
      ? t('blocking.state_line.in_duration', {
          duration: durationLabel(start.getTime() - now.getTime()),
        })
      : '',
    tone: 'v',
  }
}
