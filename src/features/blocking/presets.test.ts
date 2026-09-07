/**
 * Le mode strict des préréglages.
 *
 * Un préréglage s'active en deux taps : c'est justement pourquoi celui qui
 * VERROUILLE doit être traçable ici. Ces tests tiennent trois promesses —
 * un seul préréglage strict, une échéance exacte à annoncer avant de créer
 * quoi que ce soit, et la mention écrite dans le récapitulatif.
 */
import {
  findPreset,
  isStrictPreset,
  NEW_RULE_PRESET_IDS,
  PRESETS,
  presetLines,
  presetStrictEnd,
} from '@/features/blocking/presets'
import { isStrictRule } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'

const sleep = findPreset(NEW_RULE_PRESET_IDS.sleep)

describe('préréglages stricts', () => {
  it('« Sommeil profond » est le SEUL préréglage verrouillé', () => {
    const strict = PRESETS.filter(isStrictPreset).map(preset => preset.id)
    expect(strict).toEqual([NEW_RULE_PRESET_IDS.sleep])
  })

  it('le strict du préréglage devient celui de la règle créée', () => {
    // `config` est recopiée telle quelle à la création : c'est ce qui fait
    // qu'une règle issue du préréglage se verrouille pour de vrai.
    const rule = { config: sleep?.config } as BlockRuleView
    expect(isStrictRule(rule)).toBe(true)
  })

  it('un préréglage souple ne verrouille rien', () => {
    const work = findPreset(NEW_RULE_PRESET_IDS.work)
    expect(work && isStrictPreset(work)).toBe(false)
    expect(isStrictRule({ config: work?.config } as BlockRuleView)).toBe(false)
  })
})

describe('presetStrictEnd', () => {
  it('annonce la fin de la nuit, pas celle de la journée en cours', () => {
    // 23 h 30 : la fenêtre 22 h → 6 h tourne, elle se termine DEMAIN matin.
    const end = presetStrictEnd(
      sleep as NonNullable<typeof sleep>,
      new Date('2026-09-07T23:30:00'),
    )
    expect(end.getHours()).toBe(6)
    expect(end.getDate()).toBe(8)
  })

  it('reste sur le même jour quand l’heure de fin est encore devant', () => {
    const end = presetStrictEnd(
      sleep as NonNullable<typeof sleep>,
      new Date('2026-09-07T03:00:00'),
    )
    expect(end.getHours()).toBe(6)
    expect(end.getDate()).toBe(7)
  })

  it('compte à partir de maintenant pour un blocage minuté', () => {
    const focus = findPreset('focus')
    const now = new Date('2026-09-07T10:00:00')
    // 25 min de config → l'engagement porte sur 10 h 25.
    expect(presetStrictEnd(focus as NonNullable<typeof focus>, now)).toEqual(
      new Date('2026-09-07T10:25:00'),
    )
  })

  it('borne une limite quotidienne à minuit', () => {
    const dose = findPreset('dose')
    const end = presetStrictEnd(
      dose as NonNullable<typeof dose>,
      new Date('2026-09-07T14:00:00'),
    )
    expect(end).toEqual(new Date('2026-09-08T00:00:00'))
  })
})

describe('presetLines', () => {
  it('écrit « Mode strict » au récapitulatif du préréglage verrouillé', () => {
    const labels = presetLines(sleep as NonNullable<typeof sleep>).map(
      line => line.label,
    )
    expect(labels).toContain('Mode strict')
  })

  it('ne mentionne jamais le strict là où il n’y en a pas', () => {
    // Un « Non » partout banaliserait le mot au point qu'on ne le lirait plus
    // le jour où il vaut « Oui ».
    for (const preset of PRESETS.filter(p => !isStrictPreset(p))) {
      expect(presetLines(preset).map(line => line.label)).not.toContain(
        'Mode strict',
      )
    }
  })
})
