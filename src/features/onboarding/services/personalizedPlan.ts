import {
  findPreset,
  NEW_RULE_PRESET_IDS as IDS,
  type Preset,
} from '@/features/blocking/presets'
import type { RuleTemplateCard } from '@/features/blocking/rule-templates'
import { annualProjection } from '@/features/onboarding/services/annualProjection'
import type {
  PersonalizedPlan,
  PlanAnswers,
} from '@/features/onboarding/types/personalizedPlan'

const MOMENT_COPY: Record<string, string> = {
  bed: 'surtout le soir, au lit',
  wake: 'dès le réveil',
  work: 'pendant le travail ou les cours',
  always: 'un peu tout le temps',
}
// Rephrase without guessing gender or adding a diagnosis.
const FEELING_COPY: Record<string, string> = {
  guilt: 'de la culpabilité',
  empty: 'une sensation de vide',
  anxious: 'de l’anxiété',
  wasted: 'l’impression de perdre ton temps',
  drained: 'un manque d’énergie',
  overwhelmed: 'le sentiment que tout déborde',
  foggy: 'du brouillard dans la tête',
  regret: 'des regrets',
  unproductive: 'l’impression de ne pas avancer',
  disconnected: 'une distance avec le réel',
  angry: 'de l’énervement',
  hopeless: 'du découragement',
}
const INTENTIONS: Record<string, string> = {
  time: 'Ton objectif : retrouver du temps pour toi.',
  bed: 'Ton objectif : retrouver tes nuits.',
  focus: 'Ton objectif : retrouver ta concentration.',
  control: 'Ton objectif : reprendre la main.',
}
const MOMENT_RULES: Record<string, string[]> = {
  bed: [IDS.sleep],
  wake: [IDS.morning],
  work: [IDS.focus],
  always: [IDS.doomscroll],
}

function joinFrench(items: string[]) {
  if (items.length < 2) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`
}

/** A proposal only: no storage, permissions, app selection or native blocking. */
export function buildPersonalizedPlan(answers: PlanAnswers): PersonalizedPlan {
  const name = answers.name.trim()
  const apps = joinFrench([
    ...new Set(answers.apps.map(app => app.trim()).filter(Boolean)),
  ])
  const moment = answers.moment ? MOMENT_COPY[answers.moment] : undefined
  const recap =
    apps || moment
      ? `${name ? `${name}, tu` : 'Tu'} scrolles${apps ? ` sur ${apps}` : ''}${moment ? ` ${moment}` : ''}.`
      : `${name ? `${name}, voici` : 'Voici'} un point de départ à adapter à ton quotidien.`
  const feelings = [...new Set(answers.feelings)]
    .map(id => FEELING_COPY[id])
    .filter(Boolean)
    .slice(0, 2)
  const candidates = [...(MOMENT_RULES[answers.moment ?? ''] ?? [])]
  if (answers.trigger === 'bed') candidates.push(IDS.sleep)
  if (answers.trigger === 'focus') candidates.push(IDS.focus)
  if (
    answers.feelings.some(id =>
      ['anxious', 'drained', 'overwhelmed'].includes(id),
    )
  )
    candidates.push(IDS.decompression)
  if (answers.moment === 'bed') candidates.push(IDS.evening)
  if (candidates.length === 0) candidates.push(IDS.focus)
  const rules = [...new Set(candidates)]
    .slice(0, 2)
    .map(findPreset)
    .filter((rule): rule is Preset => Boolean(rule))
  return {
    recap,
    feeling: feelings.length
      ? `Après, tu décris ${joinFrench(feelings)}.`
      : null,
    intention:
      INTENTIONS[answers.trigger ?? ''] ??
      'Un premier pas pour retrouver du temps pour toi.',
    rules,
    hours: answers.hours,
    recoverableDays: annualProjection(answers.hours).recoverableDaysPerYear,
  }
}

/** Keep proposed rules visible even if they were beyond the old eight-card cutoff. */
export function prioritizePlanTemplates(
  templates: RuleTemplateCard[],
  recommendedIds: string[],
  count: number,
) {
  const first = recommendedIds.flatMap(id =>
    templates.filter(template => template.presetId === id),
  )
  return [
    ...first,
    ...templates.filter(
      template => !recommendedIds.includes(template.presetId),
    ),
  ].slice(0, count)
}
