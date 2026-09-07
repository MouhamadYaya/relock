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

const scheduleAt = (
  id: string,
  title: string,
  pitch: string,
  sh: number,
  sm: number,
  eh: number,
  em: number,
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
    start_minute: sm,
    end_hour: eh,
    end_minute: em,
    ...extra,
  },
})

const schedule = (
  id: string,
  title: string,
  pitch: string,
  sh: number,
  eh: number,
  extra: Record<string, unknown> = {},
): Preset => scheduleAt(id, title, pitch, sh, 0, eh, 0, extra)

export const NEW_RULE_PRESET_IDS = {
  work: 'new-rule-work',
  focus: 'new-rule-focus',
  study: 'new-rule-study',
  creative: 'new-rule-creative',
  decompression: 'new-rule-decompression',
  sleep: 'new-rule-sleep',
  evening: 'new-rule-evening',
  weekend: 'new-rule-weekend',
  morning: 'new-rule-morning',
  social: 'new-rule-social',
  doomscroll: 'new-rule-doomscroll',
  family: 'new-rule-family',
} as const

export const NEW_RULE_PRESETS: Preset[] = [
  schedule(
    NEW_RULE_PRESET_IDS.work,
    'Travail',
    'Bloque les distractions pendant tes heures de travail.',
    9,
    17,
    { days: [1, 2, 3, 4, 5] },
  ),
  schedule(
    NEW_RULE_PRESET_IDS.focus,
    'Focus laser',
    'Une heure sans interruption pour avancer sur l’essentiel.',
    14,
    15,
  ),
  schedule(
    NEW_RULE_PRESET_IDS.study,
    'Études',
    'Protège ta matinée pour apprendre sans interruption.',
    8,
    12,
    { days: [1, 2, 3, 4, 5] },
  ),
  schedule(
    NEW_RULE_PRESET_IDS.creative,
    'Création profonde',
    'Garde ton élan créatif loin des notifications.',
    19,
    21,
  ),
  schedule(
    NEW_RULE_PRESET_IDS.decompression,
    'Décompression',
    'Laisse ton esprit ralentir avant la fin de la journée.',
    20,
    22,
  ),
  // Le SEUL préréglage strict. La nuit est la fenêtre où l'engagement tient
  // tout seul : elle a une fin connue, et personne n'a de raison légitime de
  // rouvrir Instagram à 3 h. Verrouiller une journée de travail, en revanche,
  // reviendrait à confisquer le téléphone à quelqu'un qui en a besoin.
  schedule(
    NEW_RULE_PRESET_IDS.sleep,
    'Sommeil profond',
    'Protège ta nuit du scroll tardif.',
    22,
    6,
    { strict: true },
  ),
  scheduleAt(
    NEW_RULE_PRESET_IDS.evening,
    'Soirée calme',
    'Ralentis sans écran avant de dormir.',
    19,
    30,
    22,
    0,
  ),
  schedule(
    NEW_RULE_PRESET_IDS.weekend,
    'Week-end zen',
    'Commence ton week-end loin du scroll automatique.',
    9,
    12,
    { days: [0, 6] },
  ),
  schedule(
    NEW_RULE_PRESET_IDS.morning,
    'Matin sans écran',
    'Démarre la journée avant d’ouvrir tes réseaux.',
    7,
    9,
  ),
  schedule(
    NEW_RULE_PRESET_IDS.social,
    'Pause réseaux',
    'Rends tes soirées à tes proches.',
    18,
    20,
  ),
  {
    id: NEW_RULE_PRESET_IDS.doomscroll,
    title: 'Anti-doomscroll',
    pitch: 'Garde tes réseaux sans leur donner toute ta journée.',
    type: 'daily_limit',
    config: {
      name: 'Anti-doomscroll',
      preset_id: NEW_RULE_PRESET_IDS.doomscroll,
      limit_min: 20,
    },
  },
  scheduleAt(
    NEW_RULE_PRESET_IDS.family,
    'Temps en famille',
    'Profite des tiens sans interruptions numériques.',
    18,
    30,
    21,
    0,
  ),
]

export const PRESETS: Preset[] = [
  {
    id: 'focus',
    title: 'Focus',
    pitch: 'Un coup de collier, là, maintenant — pas de réglages.',
    type: 'progressive_delay',
    config: { name: 'Focus', preset_id: 'focus', duration_min: 25 },
  },
  schedule(
    'nuit',
    'Repos',
    'Le scroll du soir est celui qui coûte le plus de sommeil.',
    22,
    8,
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
    title: 'Réseaux limités',
    pitch: 'Tu gardes tes apps. Tu reprends la main sur la dose.',
    type: 'daily_limit',
    config: { name: 'Réseaux limités', preset_id: 'dose', limit_min: 30 },
  },
  {
    id: 'micro',
    title: '15 minutes par jour',
    pitch: 'La dose de secours, pour les semaines qui dérapent.',
    type: 'daily_limit',
    config: { name: '15 minutes par jour', preset_id: 'micro', limit_min: 15 },
  },
  ...NEW_RULE_PRESETS,
]

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find(p => p.id === id)
}

/** Ce préréglage arme-t-il un blocage VERROUILLÉ ? (cf. `isStrictRule`) */
export function isStrictPreset(p: Preset): boolean {
  return p.config.strict === true
}

const numCfg = (v: unknown, d: number): number =>
  typeof v === 'number' ? v : d

/**
 * Fin de la première session verrouillée — le seul chiffre qui engage, et donc
 * celui que la feuille d'engagement doit annoncer avant de créer la règle.
 * Même découpage que `sessionEnd`, mais sur un préréglage qui n'existe pas
 * encore en base : il n'y a pas de règle à interroger.
 */
export function presetStrictEnd(p: Preset, now = new Date()): Date {
  const c = p.config
  if (p.type === 'progressive_delay') {
    return new Date(now.getTime() + numCfg(c.duration_min, 30) * 60_000)
  }
  if (p.type === 'daily_limit') {
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    return midnight
  }
  const end = new Date(now)
  end.setHours(numCfg(c.end_hour, 8), numCfg(c.end_minute, 0), 0, 0)
  if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1)
  return end
}

const hh = (h: unknown, m: unknown) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

/** Ce que fait le préréglage, en une ligne — pour la carte de suggestion. */
export function presetDetail(p: Preset): string {
  const c = p.config
  if (p.type === 'daily_limit') return `${c.limit_min} min par jour`
  if (p.type === 'progressive_delay')
    return `${c.duration_min} min de blocage immédiat`
  return `${hh(c.start_hour, c.start_minute)} → ${hh(c.end_hour, c.end_minute)} · ${daysLabel((c.days as number[]) ?? null)}`
}

/**
 * Lignes du récapitulatif : ce que l'utilisateur valide, sans jargon.
 *
 * La ligne « Mode strict » n'apparaît QUE quand le préréglage en porte un —
 * afficher « Non » partout ailleurs banaliserait le mot au point qu'on ne le
 * lirait plus le jour où il vaut « Oui ». C'est le premier des deux
 * avertissements : celui-ci se lit avant de toucher quoi que ce soit, la
 * feuille d'engagement arrive ensuite.
 */
export function presetLines(p: Preset): { label: string; value: string }[] {
  const c = p.config
  const strict = isStrictPreset(p)
    ? [
        {
          label: 'Mode strict',
          value: 'Oui — impossible d’arrêter avant la fin',
        },
      ]
    : []
  if (p.type === 'daily_limit') {
    return [
      { label: 'Type', value: 'Limite de temps' },
      { label: 'Limite', value: `${c.limit_min} minutes par jour` },
      { label: 'Jours', value: 'Tous les jours' },
      { label: 'Une fois épuisée', value: 'Bloqué jusqu’à minuit' },
      ...strict,
    ]
  }
  if (p.type === 'progressive_delay') {
    return [
      { label: 'Type', value: 'Blocage minuté' },
      { label: 'Durée', value: `${c.duration_min} minutes` },
      { label: 'Démarre', value: 'Immédiatement' },
      ...strict,
    ]
  }
  return [
    { label: 'Type', value: 'Plage horaire' },
    {
      label: 'Créneau',
      value: `${hh(c.start_hour, c.start_minute)} → ${hh(c.end_hour, c.end_minute)}`,
    },
    { label: 'Jours', value: daysLabel((c.days as number[]) ?? null) },
    ...strict,
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
