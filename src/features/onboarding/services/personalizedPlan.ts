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
import i18n from '@/i18n/i18n'
import { translate as t } from '@/i18n/translate'

/**
 * Les identifiants de réponse, tels qu'ils sortent du questionnaire.
 *
 * Le texte, lui, vit dans les fichiers de langue (`onboarding_plan.*`) : ce
 * module recoud des phrases, et une phrase recousue à partir de fragments
 * français codés en dur ne peut pas se traduire — c'est ce qui laissait tout
 * le plan personnalisé en français dans une app anglaise ou espagnole.
 */
const MOMENT_IDS = [
  'bed',
  'wake',
  'work',
  'break',
  'transport',
  'meals',
  'weekend',
  'always',
] as const

const FEELING_IDS = [
  'guilt',
  'empty',
  'anxious',
  'wasted',
  'drained',
  'overwhelmed',
  'foggy',
  'regret',
  'unproductive',
  'disconnected',
  'angry',
  'hopeless',
  'ashamed',
  'lonely',
  'restless',
  'numb',
] as const

const STOLEN_IDS = [
  'nights',
  'people',
  'becoming',
  'focus',
  'presence',
  'energy',
  'mornings',
  'sport',
  'projects',
  'calm',
  'pride',
] as const

const ATTEMPT_IDS = [
  'deleted',
  'limit',
  'willpower',
  'distance',
  'hidden',
  'grayscale',
  'notifications',
  'blocker',
  'detox',
  'logout',
] as const

const ASPIRATION_IDS = [
  'sleep',
  'move',
  'read',
  'people',
  'project',
  'hobby',
  'breathe',
  'cook',
  'work',
  'morning',
  'study',
  'present',
  'family',
  'nature',
  'learn',
  'create',
  'music',
  'silence',
] as const

/** Repli quand la question de l'objectif n'a pas été posée (saut de DEV). */
const DEFAULT_ASPIRATION_WORD_KEYS = [
  'presence',
  'sleep',
  'calm',
  'freedom',
  'life',
] as const

/**
 * L'ordre COMPTE : plusieurs motivations peuvent être cochées, et c'est la
 * première d'entre elles présente ici qui donne la phrase d'objectif. Du plus
 * précis (« tes nuits ») au plus général (« reprendre la main »), pour qu'un
 * choix multiple n'aboutisse pas à la formule la plus vague.
 */
const INTENTION_IDS = [
  'bed',
  'sleep',
  'focus',
  'goals',
  'presence',
  'mood',
  'habit',
  'time',
  'control',
] as const

const MOMENT_RULES: Record<string, string[]> = {
  bed: [IDS.sleep],
  wake: [IDS.morning],
  work: [IDS.focus],
  break: [IDS.work],
  transport: [IDS.doomscroll],
  meals: [IDS.family],
  weekend: [IDS.weekend],
  always: [IDS.doomscroll],
}

/** Ce que la motivation ajoute aux règles proposées, après les moments. */
const TRIGGER_RULES: Record<string, string> = {
  bed: IDS.sleep,
  sleep: IDS.sleep,
  focus: IDS.focus,
  goals: IDS.study,
  habit: IDS.doomscroll,
  mood: IDS.decompression,
  presence: IDS.family,
}

/** Deux citations suffisent à faire une phrase juste ; trois font une liste. */
const MAX_QUOTED = 2

/** Traduit un identifiant, ou rend `undefined` s'il n'est pas au catalogue. */
function copy(
  section: string,
  allowed: readonly string[],
  id: string,
): string | undefined {
  return allowed.includes(id)
    ? t(`onboarding_plan.${section}.${id}`)
    : undefined
}

/** Les réponses retenues, dédupliquées, traduites, et bornées à deux. */
function pick(ids: string[], section: string, allowed: readonly string[]) {
  return [...new Set(ids)]
    .map(id => copy(section, allowed, id))
    .filter((value): value is string => Boolean(value))
    .slice(0, MAX_QUOTED)
}

/**
 * « a, b et c » — avec la conjonction de la langue courante.
 *
 * L'espagnol impose « e » (et non « y ») devant un mot commençant par le son
 * /i/ : « sueño e insomnio ». Le cas est fréquent ici — « ilusión »,
 * « energía » n'en fait pas partie mais « imagen » oui — et une conjonction
 * fausse se remarque immédiatement pour un lecteur natif.
 */
function joinList(items: string[]) {
  if (items.length < 2) return items[0] ?? ''
  const last = items[items.length - 1] ?? ''
  const head = items.slice(0, -1).join(t('onboarding_plan.list.separator'))
  let conjunction = t('onboarding_plan.list.and')
  if (
    i18n.language.startsWith('es') &&
    /^(i|hi(?!e))/i.test(last.replace(/^[¿¡"'«\s]+/, ''))
  ) {
    conjunction = t('onboarding_plan.list.and_alt')
  }
  return `${head}${conjunction}${last}`
}

/** A proposal only: no storage, permissions, app selection or native blocking. */
export function buildPersonalizedPlan(answers: PlanAnswers): PersonalizedPlan {
  const name = answers.name.trim()
  const apps = joinList([
    ...new Set(answers.apps.map(app => app.trim()).filter(Boolean)),
  ])
  const moment = joinList(pick(answers.moment, 'moment', MOMENT_IDS))
  const recap = buildRecap(name, apps, moment)
  const feelings = pick(answers.feelings, 'feeling', FEELING_IDS)
  // Les moments d'abord (c'est eux que la règle protégera), la motivation
  // ensuite : à deux règles proposées, l'ordre décide laquelle survit.
  const candidates = answers.moment.flatMap(id => MOMENT_RULES[id] ?? [])
  for (const id of answers.trigger) {
    const rule = TRIGGER_RULES[id]
    if (rule) candidates.push(rule)
  }
  if (
    answers.feelings.some(id =>
      ['anxious', 'drained', 'overwhelmed'].includes(id),
    )
  )
    candidates.push(IDS.decompression)
  if (answers.moment.includes('bed')) candidates.push(IDS.evening)
  if (candidates.length === 0) candidates.push(IDS.focus)
  const rules = [...new Set(candidates)]
    .slice(0, 2)
    .map(findPreset)
    .filter((rule): rule is Preset => Boolean(rule))
  const stolen = pick(answers.stolen, 'stolen', STOLEN_IDS)
  const tried = pick(answers.attempts, 'attempt', ATTEMPT_IDS)
  const aspirations = pick(answers.aspirations, 'aspiration', ASPIRATION_IDS)
  const words = [...new Set(answers.aspirations)]
    .map(id => copy('aspiration_word', ASPIRATION_IDS, id))
    .filter((value): value is string => Boolean(value))
  const intentionId = INTENTION_IDS.find(id => answers.trigger.includes(id))
  return {
    recap,
    feeling: feelings.length
      ? t('onboarding_plan.feeling_sentence', { feelings: joinList(feelings) })
      : null,
    loss: stolen.length
      ? t('onboarding_plan.loss_sentence', { stolen: joinList(stolen) })
      : null,
    defense: buildDefense(answers.attempts, tried),
    intention: intentionId
      ? t(`onboarding_plan.intention.${intentionId}`)
      : t('onboarding_plan.intention_default'),
    rules,
    hours: answers.hours,
    recoverableDays: annualProjection(answers.hours).recoverableDaysPerYear,
    // Toutes les réponses défilent ici (pas seulement les deux citées en
    // prose) : le compteur a le temps de les montrer une par une.
    aspirationWords: words.length
      ? words
      : DEFAULT_ASPIRATION_WORD_KEYS.map(key =>
          t(`onboarding_plan.default_word.${key}`),
        ),
    aspirationSummary: aspirations.length ? joinList(aspirations) : null,
  }
}

/**
 * La phrase d'ouverture, choisie parmi six gabarits complets.
 *
 * Coller « sur {apps} » puis « {moment} » derrière un tronc commun marchait en
 * français et nulle part ailleurs : l'anglais veut « you scroll on X in the
 * evening », l'espagnol place le prénom autrement. Chaque combinaison a donc
 * sa phrase entière, que chaque langue écrit comme elle l'entend.
 */
function buildRecap(name: string, apps: string, moment: string): string {
  const scope =
    apps && moment ? 'apps_moment' : apps ? 'apps' : moment ? 'moment' : null
  if (!scope) {
    return name
      ? t('onboarding_plan.recap.fallback_named', { name })
      : t('onboarding_plan.recap.fallback')
  }
  const key = name ? `named_${scope}` : scope
  return t(`onboarding_plan.recap.${key}`, { name, apps, moment })
}

/**
 * La promesse tenue par ce plan, opposée à ce qui a déjà lâché. On ne cite
 * que deux méthodes : au-delà, la phrase devient un inventaire et personne ne
 * la lit jusqu'au bout.
 */
function buildDefense(ids: string[], tried: string[]): string | null {
  if (ids.includes('never') && tried.length === 0)
    return t('onboarding_plan.defense_never')
  if (tried.length === 0) return null
  return t('onboarding_plan.defense_tried', { tried: joinList(tried) })
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
