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
import i18n from '@/i18n/i18n'
import { translate as t } from '@/i18n/translate'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'

export type Preset = {
  id: string
  title: string
  /** Pourquoi ce moment-là mérite d'être protégé — une phrase, pas un slogan. */
  pitch: string
  type: BlockRuleType
  config: Record<string, unknown>
}

/**
 * Le titre et le pitch d'un préréglage vivent dans les fichiers de langue
 * (`blocking.presets.<id>`), et non plus dans ce fichier.
 *
 * `config.name` reçoit le titre TRADUIT au moment de la création : c'est le
 * nom que l'utilisateur verra ensuite sur sa règle, et il doit être dans la
 * langue où il l'a créée — pas figé en français à l'import du module.
 */
const presetCopy = (id: string) => ({
  title: t(`blocking.presets.${id}.title`),
  pitch: t(`blocking.presets.${id}.pitch`),
})

const scheduleAt = (
  id: string,
  sh: number,
  sm: number,
  eh: number,
  em: number,
  extra: Record<string, unknown> = {},
): Preset => {
  const { title, pitch } = presetCopy(id)
  return {
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
  }
}

const schedule = (
  id: string,
  sh: number,
  eh: number,
  extra: Record<string, unknown> = {},
): Preset => scheduleAt(id, sh, 0, eh, 0, extra)

const dailyLimit = (id: string, limitMin: number): Preset => {
  const { title, pitch } = presetCopy(id)
  return {
    id,
    title,
    pitch,
    type: 'daily_limit',
    config: { name: title, preset_id: id, limit_min: limitMin },
  }
}

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

/**
 * Les 12 préréglages « Nouvelle règle », reconstruits à chaque changement de
 * langue.
 *
 * Un tableau `const` figeait les libellés à l'import du module : passer l'app
 * en espagnol laissait « Sommeil profond » sur la carte, et écrivait ce nom
 * français dans la règle créée.
 */
function buildNewRulePresets(): Preset[] {
  return [
    schedule(NEW_RULE_PRESET_IDS.work, 9, 17, { days: [1, 2, 3, 4, 5] }),
    schedule(NEW_RULE_PRESET_IDS.focus, 14, 15),
    schedule(NEW_RULE_PRESET_IDS.study, 8, 12, { days: [1, 2, 3, 4, 5] }),
    schedule(NEW_RULE_PRESET_IDS.creative, 19, 21),
    schedule(NEW_RULE_PRESET_IDS.decompression, 20, 22),
    // Le SEUL préréglage strict. La nuit est la fenêtre où l'engagement tient
    // tout seul : elle a une fin connue, et personne n'a de raison légitime de
    // rouvrir Instagram à 3 h. Verrouiller une journée de travail, en revanche,
    // reviendrait à confisquer le téléphone à quelqu'un qui en a besoin.
    schedule(NEW_RULE_PRESET_IDS.sleep, 22, 6, { strict: true }),
    scheduleAt(NEW_RULE_PRESET_IDS.evening, 19, 30, 22, 0),
    schedule(NEW_RULE_PRESET_IDS.weekend, 9, 12, { days: [0, 6] }),
    schedule(NEW_RULE_PRESET_IDS.morning, 7, 9),
    schedule(NEW_RULE_PRESET_IDS.social, 18, 20),
    dailyLimit(NEW_RULE_PRESET_IDS.doomscroll, 20),
    scheduleAt(NEW_RULE_PRESET_IDS.family, 18, 30, 21, 0),
  ]
}

function buildPresets(): Preset[] {
  return [
    {
      id: 'focus',
      ...presetCopy('focus'),
      type: 'progressive_delay',
      config: {
        name: t('blocking.presets.focus.title'),
        preset_id: 'focus',
        duration_min: 25,
      },
    },
    schedule('nuit', 22, 8),
    schedule('reveil', 6, 8),
    schedule('matin', 9, 12, { days: [1, 2, 3, 4, 5] }),
    schedule('aprem', 14, 18, { days: [1, 2, 3, 4, 5] }),
    schedule('repas', 12, 14),
    schedule('weekend', 10, 18, { days: [0, 6] }),
    dailyLimit('dose', 30),
    dailyLimit('micro', 15),
    ...buildNewRulePresets(),
  ]
}

/**
 * Le catalogue courant, mémorisé PAR LANGUE.
 *
 * Reconstruire à chaque appel casserait l'identité des objets — plusieurs
 * écrans comparent le préréglage rendu par `findPreset` à celui qu'ils ont
 * déjà en main. Mémoriser sans clé de langue rendrait au contraire des
 * libellés périmés après un changement de langue. La clé est donc la langue.
 */
let cache: { language: string; presets: Preset[] } | null = null

export function allPresets(): Preset[] {
  if (cache?.language !== i18n.language) {
    cache = { language: i18n.language, presets: buildPresets() }
  }
  return cache.presets
}

/** Les 12 préréglages de l'écran « Nouvelle règle », dans la langue courante. */
export function newRulePresets(): Preset[] {
  const ids = new Set<string>(Object.values(NEW_RULE_PRESET_IDS))
  return allPresets().filter(preset => ids.has(preset.id))
}

export function findPreset(id: string): Preset | undefined {
  return allPresets().find(p => p.id === id)
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
  if (p.type === 'daily_limit')
    return t('blocking.preset_detail.limit', { minutes: c.limit_min })
  if (p.type === 'progressive_delay')
    return t('blocking.preset_detail.timed', { minutes: c.duration_min })
  return t('blocking.preset_detail.schedule', {
    start: hh(c.start_hour, c.start_minute),
    end: hh(c.end_hour, c.end_minute),
    days: daysLabel((c.days as number[]) ?? null),
  })
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
          label: t('blocking.preset_lines.strict'),
          value: t('blocking.preset_lines.strict_yes'),
        },
      ]
    : []
  if (p.type === 'daily_limit') {
    return [
      {
        label: t('blocking.preset_lines.type'),
        value: t('blocking.rule_types.limit'),
      },
      {
        label: t('blocking.preset_lines.limit'),
        value: t('blocking.preset_lines.limit_value', {
          minutes: c.limit_min,
        }),
      },
      {
        label: t('blocking.preset_lines.days'),
        value: t('blocking.days.every_day'),
      },
      {
        label: t('blocking.preset_lines.once_spent'),
        value: t('blocking.preset_lines.once_spent_value'),
      },
      ...strict,
    ]
  }
  if (p.type === 'progressive_delay') {
    return [
      {
        label: t('blocking.preset_lines.type'),
        value: t('blocking.rule_types.timed'),
      },
      {
        label: t('blocking.preset_lines.duration'),
        value: t('blocking.preset_lines.duration_value', {
          minutes: c.duration_min,
        }),
      },
      {
        label: t('blocking.preset_lines.starts'),
        value: t('blocking.preset_lines.starts_now'),
      },
      ...strict,
    ]
  }
  return [
    {
      label: t('blocking.preset_lines.type'),
      value: t('blocking.rule_types.schedule'),
    },
    {
      label: t('blocking.preset_lines.slot'),
      value: `${hh(c.start_hour, c.start_minute)} → ${hh(c.end_hour, c.end_minute)}`,
    },
    {
      label: t('blocking.preset_lines.days'),
      value: daysLabel((c.days as number[]) ?? null),
    },
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
  return allPresets().filter(p => !used.has(p.id))
}
