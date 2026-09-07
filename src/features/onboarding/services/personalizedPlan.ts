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
  break: 'pendant tes pauses',
  transport: 'dans les transports',
  meals: 'pendant les repas',
  weekend: 'le week-end, des heures entières',
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
  ashamed: 'de la honte',
  lonely: 'de la solitude',
  restless: 'de l’agitation',
  numb: 'une forme d’anesthésie',
}

/**
 * Ce que le scroll a volé, reformulé au « tu » pour être recousu dans une
 * phrase. Les libellés d'origine sont à la première personne (c'est un aveu
 * que l'utilisateur signe) ; ici c'est le plan qui parle, il le lui rend.
 */
const STOLEN_COPY: Record<string, string> = {
  nights: 'des nuits',
  people: 'des moments avec les gens que tu aimes',
  becoming: 'du temps pour devenir qui tu veux être',
  focus: 'ta concentration',
  presence: 'des moments où tu aurais voulu être là',
  energy: 'ton énergie',
  mornings: 'tes matins',
  sport: 'l’envie de bouger',
  projects: 'des projets jamais commencés',
  calm: 'le calme dans ta tête',
  pride: 'la fierté de tes journées',
}

/**
 * Pourquoi chaque méthode déjà tentée a lâché. Jamais un reproche : c'est la
 * méthode qui est en cause, pas la personne — la même thèse que l'écran
 * « Tu n'es pas le problème ».
 */
const ATTEMPT_COPY: Record<string, string> = {
  deleted: 'réinstaller une app prend dix secondes',
  limit: "une limite d'écran se repousse d'un tap",
  willpower: "la volonté seule tient jusqu'au premier soir difficile",
  distance: 'un téléphone posé plus loin se rattrape en dix pas',
  hidden: "une app cachée s'ouvre quand même",
  grayscale: 'un écran gris se remet en couleur en trois taps',
  notifications:
    "une notification coupée n'empêche pas d'ouvrir l'app soi-même",
  blocker: 'un blocage qui se désactive tout seul ne bloque rien',
  detox: "une détox a une date de fin, et l'habitude attend derrière",
  logout: 'se reconnecter prend le temps d’un mot de passe enregistré',
}

/** Ce que le temps récupéré redevient, dans la phrase d'objectif. */
const ASPIRATION_COPY: Record<string, string> = {
  sleep: 'dormir',
  move: 'bouger',
  read: 'lire',
  people: 'voir tes proches',
  project: 'avancer sur un projet',
  hobby: 'reprendre un hobby',
  breathe: 'souffler',
  cook: 'cuisiner',
  work: 'mieux travailler',
  morning: 'retrouver tes matins',
  study: 'réussir tes études',
  present: 'être présent',
  family: 'être avec ta famille',
  nature: 'sortir dehors',
  learn: 'apprendre',
  create: 'créer',
  music: 'faire de la musique',
  silence: 'ne rien faire, vraiment',
}

/** Le suffixe qui défile sur le compteur du bon verdict (« 47 jours · … »). */
const ASPIRATION_WORDS: Record<string, string> = {
  sleep: 'de Sommeil',
  move: 'de Sport',
  read: 'de Lecture',
  people: 'avec les tiens',
  project: 'de Projets',
  hobby: 'de Plaisir',
  breathe: 'de Calme',
  cook: 'de Cuisine',
  work: 'de Clarté',
  morning: 'de Matins',
  study: 'de Réussite',
  present: 'de Présence',
  family: 'en Famille',
  nature: 'Dehors',
  learn: 'd’Apprentissage',
  create: 'de Création',
  music: 'de Musique',
  silence: 'de Silence',
}

/** Repli quand la question de l'objectif n'a pas été posée (saut de DEV). */
const DEFAULT_ASPIRATION_WORDS = [
  'de Présence',
  'de Sommeil',
  'de Calme',
  'de Liberté',
  'de Vie',
]

/**
 * L'ordre COMPTE : plusieurs motivations peuvent être cochées, et c'est la
 * première d'entre elles présente ici qui donne la phrase d'objectif. Du plus
 * précis (« tes nuits ») au plus général (« reprendre la main »), pour qu'un
 * choix multiple n'aboutisse pas à la formule la plus vague.
 */
const INTENTIONS: [id: string, intention: string][] = [
  ['bed', 'Ton objectif : retrouver tes nuits.'],
  ['sleep', 'Ton objectif : retrouver un vrai sommeil.'],
  ['focus', 'Ton objectif : retrouver ta concentration.'],
  ['goals', 'Ton objectif : tenir tes journées.'],
  ['presence', 'Ton objectif : être vraiment là.'],
  ['mood', 'Ton objectif : avoir la tête plus légère.'],
  ['habit', 'Ton objectif : casser le réflexe.'],
  ['time', 'Ton objectif : retrouver du temps pour toi.'],
  ['control', 'Ton objectif : reprendre la main.'],
]
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

/** Les réponses retenues, dédupliquées, traduites, et bornées à deux. */
function pick(ids: string[], copy: Record<string, string>) {
  return [...new Set(ids)]
    .map(id => copy[id])
    .filter(Boolean)
    .slice(0, MAX_QUOTED)
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
  const moment = joinFrench(pick(answers.moment, MOMENT_COPY))
  const recap =
    apps || moment
      ? `${name ? `${name}, tu` : 'Tu'} scrolles${apps ? ` sur ${apps}` : ''}${moment ? ` ${moment}` : ''}.`
      : `${name ? `${name}, voici` : 'Voici'} un point de départ à adapter à ton quotidien.`
  const feelings = [...new Set(answers.feelings)]
    .map(id => FEELING_COPY[id])
    .filter(Boolean)
    .slice(0, 2)
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
  const stolen = pick(answers.stolen, STOLEN_COPY)
  const tried = pick(answers.attempts, ATTEMPT_COPY)
  const aspirations = pick(answers.aspirations, ASPIRATION_COPY)
  const words = [...new Set(answers.aspirations)]
    .map(id => ASPIRATION_WORDS[id])
    .filter(Boolean)
  return {
    recap,
    feeling: feelings.length
      ? `Après, tu décris ${joinFrench(feelings)}.`
      : null,
    loss: stolen.length ? `Et ça t'a déjà pris ${joinFrench(stolen)}.` : null,
    defense: buildDefense(answers.attempts, tried),
    intention:
      INTENTIONS.find(([id]) => answers.trigger.includes(id))?.[1] ??
      'Un premier pas pour retrouver du temps pour toi.',
    rules,
    hours: answers.hours,
    recoverableDays: annualProjection(answers.hours).recoverableDaysPerYear,
    // Toutes les réponses défilent ici (pas seulement les deux citées en
    // prose) : le compteur a le temps de les montrer une par une.
    aspirationWords: words.length ? words : DEFAULT_ASPIRATION_WORDS,
    aspirationSummary: aspirations.length ? joinFrench(aspirations) : null,
  }
}

/**
 * La promesse tenue par ce plan, opposée à ce qui a déjà lâché. On ne cite
 * que deux méthodes : au-delà, la phrase devient un inventaire et personne ne
 * la lit jusqu'au bout.
 */
function buildDefense(ids: string[], tried: string[]): string | null {
  if (ids.includes('never') && tried.length === 0)
    return "Tu n'as pas encore vraiment essayé. Autant commencer par quelque chose qui tient tout seul."
  if (tried.length === 0) return null
  return `Tu as déjà essayé, mais ${joinFrench(tried)}. Ton plan, lui, se règle à froid — au moment où tu y vois clair — et ne se retire pas à chaud.`
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
