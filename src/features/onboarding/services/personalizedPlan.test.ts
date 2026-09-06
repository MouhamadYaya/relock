import type { TFunction } from 'i18next'
import {
  findPreset,
  NEW_RULE_PRESET_IDS as IDS,
} from '@/features/blocking/presets'
import { buildRuleTemplates } from '@/features/blocking/rule-templates'
import {
  buildPersonalizedPlan,
  prioritizePlanTemplates,
} from '@/features/onboarding/services/personalizedPlan'
import type { PlanAnswers } from '@/features/onboarding/types/personalizedPlan'

const answers: PlanAnswers = {
  name: ' Léa ',
  apps: ['TikTok', 'Instagram'],
  moment: 'bed',
  trigger: 'bed',
  feelings: ['empty'],
  hours: 5,
}

describe('personalized onboarding plan', () => {
  it('reflects real answers and reuses the presets that will be activated', () => {
    const plan = buildPersonalizedPlan(answers)
    expect(plan.recap).toBe(
      'Léa, tu scrolles sur TikTok et Instagram surtout le soir, au lit.',
    )
    expect(plan.feeling).toBe('Après, tu décris une sensation de vide.')
    expect(plan.intention).toBe('Ton objectif : retrouver tes nuits.')
    expect(plan.recoverableDays).toBe(38)
    expect(plan.rules.map(rule => rule.id)).toEqual([IDS.sleep, IDS.evening])
    for (const rule of plan.rules) expect(rule).toBe(findPreset(rule.id))
  })

  it.each([
    ['wake', IDS.morning],
    ['work', IDS.focus],
    ['always', IDS.doomscroll],
  ])('prioritizes %s rather than always suggesting work', (moment, first) => {
    const plan = buildPersonalizedPlan({ ...answers, moment, trigger: 'time' })
    expect(plan.rules[0].id).toBe(first)
  })

  it('uses motivation and feelings without duplicating rules', () => {
    const plan = buildPersonalizedPlan({
      ...answers,
      moment: 'wake',
      trigger: 'focus',
    })
    expect(plan.rules.map(rule => rule.id)).toEqual([IDS.morning, IDS.focus])
    const calmer = buildPersonalizedPlan({
      ...answers,
      moment: 'work',
      trigger: 'focus',
      feelings: ['anxious'],
    })
    expect(calmer.rules.map(rule => rule.id)).toEqual([
      IDS.focus,
      IDS.decompression,
    ])
  })

  it('does not invent answers when opened without the diagnostic in development', () => {
    const plan = buildPersonalizedPlan({
      name: '',
      apps: [],
      moment: null,
      trigger: null,
      feelings: [],
      hours: 1,
    })
    expect(plan.recap).toBe(
      'Voici un point de départ à adapter à ton quotidien.',
    )
    expect(plan.feeling).toBeNull()
    expect(plan.recoverableDays).toBe(8)
  })

  it('keeps recommendations beyond the former cutoff visible in the activation carousel', () => {
    const templates = buildRuleTemplates(((key: string) => key) as TFunction)
    const ids = [IDS.morning, IDS.doomscroll]
    const ordered = prioritizePlanTemplates(templates, ids, 8)
    expect(ordered.slice(0, 2).map(template => template.presetId)).toEqual(ids)
    expect(ordered).toHaveLength(8)
    expect(new Set(ordered.map(template => template.presetId)).size).toBe(8)
    expect(templates[0].presetId).toBe(IDS.work)
  })
})
