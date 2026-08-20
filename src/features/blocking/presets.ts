/**
 * Préréglages « Essayez ceci ensuite » — des moments à protéger que presque
 * tout le monde reconnaît, prêts à activer. C'est la réponse à la page blanche :
 * face à « crée un blocage », on ne sait pas quoi choisir ; face à « Nuit
 * tranquille, 22:00 → 07:00 », si.
 *
 * ⚠️ Un préréglage ne choisit PAS les apps : le sélecteur d'Apple rend un jeton
 * opaque que seul l'utilisateur peut produire — aucune API ne permet de
 * pré-cocher Instagram. On réutilise donc sa dernière sélection quand elle
 * existe ; sinon il la choisit une fois, et c'est tout ce qu'on lui demande.
 *
 * `preset_id` est écrit dans la config à la création : c'est ce qui permet de
 * ne jamais reproposer un blocage déjà en place — une suggestion qu'on a déjà
 * suivie ne suggère plus rien, elle fait de la publicité.
 */

import { daysLabel } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'

export type Preset = {
  id: string
  title: string
  /** Pourquoi ce moment-là mérite d'être protégé — une phrase, pas un slogan. */
  pitch: string
  type: BlockRuleType
  config: Record<string, unknown>
}

const schedule = (
  id: string,
  title: string,
  pitch: string,
  sh: number,
  eh: number,
  extra: Record<string, unknown> = {},
): Preset => ({
  id,
  title,
  pitch,
  type: 'schedule',
  config: {
    name: title,
    preset_id: id,
    start_hour: sh,
    start_minute: 0,
    end_hour: eh,
    end_minute: 0,
    ...extra,
  },
})

export const PRESETS: Preset[] = [
  schedule(
    'nuit',
    'Nuit tranquille',
    'Le scroll du soir est celui qui coûte le plus de sommeil.',
    22,
    7,
  ),
  schedule(
    'reveil',
    'Premier réveil',
    'Ce que tu regardes en premier décide de ton humeur.',
    6,
    8,
  ),
  schedule(
    'matin',
    'Matinée concentrée',
    'Les premières heures décident du reste de la journée.',
    9,
    12,
    { days: [1, 2, 3, 4, 5] },
  ),
  schedule(
    'aprem',
    'Creux de l’après-midi',
    'C’est à l’heure molle que la main part toute seule.',
    14,
    18,
    { days: [1, 2, 3, 4, 5] },
  ),
  schedule(
    'repas',
    'À table',
    'Un repas sans téléphone, c’est un repas dont tu te souviens.',
    12,
    14,
  ),
  schedule(
    'weekend',
    'Week-end dehors',
    'Deux jours par semaine où personne ne t’attend en ligne.',
    10,
    18,
    { days: [0, 6] },
  ),
  {
    id: 'dose',
    title: '30 minutes par jour',
    pitch: 'Tu gardes tes apps. Tu reprends la main sur la dose.',
    type: 'daily_limit',
    config: { name: '30 minutes par jour', preset_id: 'dose', limit_min: 30 },
  },
  {
    id: 'micro',
    title: '15 minutes par jour',
    pitch: 'La dose de secours, pour les semaines qui dérapent.',
    type: 'daily_limit',
    config: { name: '15 minutes par jour', preset_id: 'micro', limit_min: 15 },
  },
]

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find(p => p.id === id)
}

const hh = (h: unknown, m: unknown) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

/** Ce que fait le préréglage, en une ligne — pour la carte de suggestion. */
export function presetDetail(p: Preset): string {
  const c = p.config
  if (p.type === 'daily_limit') return `Au-delà, bloqué jusqu’à minuit`
  return `${daysLabel((c.days as number[]) ?? null)}, ${hh(c.start_hour, c.start_minute)} → ${hh(c.end_hour, c.end_minute)}`
}

/** Lignes du récapitulatif : ce que l'utilisateur valide, sans jargon. */
export function presetLines(p: Preset): { label: string; value: string }[] {
  const c = p.config
  if (p.type === 'daily_limit') {
    return [
      { label: 'Type', value: 'Limite de temps' },
      { label: 'Limite', value: `${c.limit_min} minutes par jour` },
      { label: 'Jours', value: 'Tous les jours' },
      { label: 'Une fois épuisée', value: 'Bloqué jusqu’à minuit' },
    ]
  }
  return [
    { label: 'Type', value: 'Plage horaire' },
    {
      label: 'Créneau',
      value: `${hh(c.start_hour, c.start_minute)} → ${hh(c.end_hour, c.end_minute)}`,
    },
    { label: 'Jours', value: daysLabel((c.days as number[]) ?? null) },
  ]
}

/** Préréglages pas encore en place — on ne suggère jamais ce qui existe déjà. */
export function availablePresets(rules: BlockRuleView[]): Preset[] {
  const used = new Set(
    rules
      .map(r => (r.config as Record<string, unknown> | null)?.preset_id)
      .filter(Boolean),
  )
  return PRESETS.filter(p => !used.has(p.id))
}
