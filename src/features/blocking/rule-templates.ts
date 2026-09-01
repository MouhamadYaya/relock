/**
 * Métadonnées des 12 préréglages « Nouvelle règle », partagées avec l'état
 * vide de l'onglet Blocages (mêmes cartes, mêmes libellés) — pour ne jamais
 * avoir deux définitions de « ce que propose Travail » qui divergent.
 */

import type { TFunction } from 'i18next'
import type { ImageSourcePropType } from 'react-native'
import type { RuleTypeGlyphKind } from '@/features/blocking/components/BlockingGlyphs'
import { NEW_RULE_PRESET_IDS } from '@/features/blocking/presets'

export type RuleTemplateId = keyof typeof NEW_RULE_PRESET_IDS

export interface RuleTemplateCard {
  id: RuleTemplateId
  presetId: string
  kind: RuleTypeGlyphKind
  image: ImageSourcePropType
  time: string
  title: string
  description: string
  addLabel: string
}

const TEMPLATE_IMAGES = {
  work: require('@assets/blocking/work.png'),
  focus: require('@assets/blocking/focus.png'),
  study: require('@assets/blocking/study.png'),
  creative: require('@assets/blocking/creative.png'),
  decompression: require('@assets/blocking/decompression.png'),
  sleep: require('@assets/blocking/sleep.png'),
  evening: require('@assets/blocking/evening.png'),
  weekend: require('@assets/blocking/weekend.png'),
  morning: require('@assets/blocking/morning.png'),
  social: require('@assets/blocking/social.png'),
  doomscroll: require('@assets/blocking/doomscroll.png'),
  family: require('@assets/blocking/family.png'),
} as const

/** Construit les 12 cartes, `t` résolue — copie identique à la page Nouvelle règle. */
export function buildRuleTemplates(t: TFunction): RuleTemplateCard[] {
  const copy = (id: RuleTemplateId) => ({
    time: t(`blocking.new_rule.templates.${id}.time`),
    title: t(`blocking.new_rule.templates.${id}.title`),
    description: t(`blocking.new_rule.templates.${id}.description`),
    addLabel: t(`blocking.new_rule.templates.${id}.add`),
  })

  return [
    {
      id: 'work',
      presetId: NEW_RULE_PRESET_IDS.work,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.work,
      ...copy('work'),
    },
    {
      id: 'focus',
      presetId: NEW_RULE_PRESET_IDS.focus,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.focus,
      ...copy('focus'),
    },
    {
      id: 'study',
      presetId: NEW_RULE_PRESET_IDS.study,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.study,
      ...copy('study'),
    },
    {
      id: 'creative',
      presetId: NEW_RULE_PRESET_IDS.creative,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.creative,
      ...copy('creative'),
    },
    {
      id: 'decompression',
      presetId: NEW_RULE_PRESET_IDS.decompression,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.decompression,
      ...copy('decompression'),
    },
    {
      id: 'sleep',
      presetId: NEW_RULE_PRESET_IDS.sleep,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.sleep,
      ...copy('sleep'),
    },
    {
      id: 'evening',
      presetId: NEW_RULE_PRESET_IDS.evening,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.evening,
      ...copy('evening'),
    },
    {
      id: 'weekend',
      presetId: NEW_RULE_PRESET_IDS.weekend,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.weekend,
      ...copy('weekend'),
    },
    {
      id: 'morning',
      presetId: NEW_RULE_PRESET_IDS.morning,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.morning,
      ...copy('morning'),
    },
    {
      id: 'social',
      presetId: NEW_RULE_PRESET_IDS.social,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.social,
      ...copy('social'),
    },
    {
      id: 'doomscroll',
      presetId: NEW_RULE_PRESET_IDS.doomscroll,
      kind: 'limit',
      image: TEMPLATE_IMAGES.doomscroll,
      ...copy('doomscroll'),
    },
    {
      id: 'family',
      presetId: NEW_RULE_PRESET_IDS.family,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.family,
      ...copy('family'),
    },
  ]
}

/** Tirage sans remise — pour les 3 suggestions de l'état vide, jamais deux fois la même. */
export function pickRandomRuleTemplates(
  templates: RuleTemplateCard[],
  count: number,
): RuleTemplateCard[] {
  const pool = [...templates]
  const picked: RuleTemplateCard[] = []
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length)
    picked.push(pool.splice(index, 1)[0])
  }
  return picked
}
