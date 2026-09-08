/**
 * Les clés construites À L'EXÉCUTION résolvent-elles vraiment ?
 *
 * C'est l'angle mort exact de `check-i18n.cjs` : il compare fr / en / es entre
 * eux, donc une clé absente des TROIS passe inaperçue — et i18next affiche
 * alors la clé brute à l'écran (« blocking.presets.new-rule-work.title »).
 * Le typage littéral de `t()` ne la voit pas non plus : une clé assemblée dans
 * un gabarit n'est plus une chaîne connue du compilateur.
 *
 * On appelle donc le vrai code, dans les trois langues, et on vérifie que
 * rien ne ressemble à un identifiant.
 */
import {
  allPresets,
  NEW_RULE_PRESET_IDS,
  presetDetail,
  presetLines,
} from '@/features/blocking/presets'
import { daysLabel } from '@/features/blocking/session'
import { appsSubtitle, ruleTypeLabel } from '@/features/blocking/types'
import { NOTIF_CATALOG } from '@/features/notifications/catalog'
import { context } from '@/features/notifications/notif-test-fixtures'
import { SCREEN_TIME_ESTIMATES } from '@/features/onboarding/services/annualProjection'
import { buildPersonalizedPlan } from '@/features/onboarding/services/personalizedPlan'
import i18n, { SUPPORTED_LANGUAGES } from '@/i18n/i18n'
import { translate } from '@/i18n/translate'

/** Une valeur non traduite ressemble à `section.sous_section.cle`. */
const RAW_KEY = /^[a-z0-9_]+(\.[a-z0-9_.-]+)+$/i

function expectResolved(value: string, what: string) {
  expect(typeof value).toBe('string')
  expect(value.trim()).not.toBe('')
  if (RAW_KEY.test(value.trim())) {
    throw new Error(`${what} rend la clé brute « ${value} »`)
  }
}

const eachLanguage = (run: () => void) => {
  for (const language of SUPPORTED_LANGUAGES) {
    it(`en ${language}`, async () => {
      await i18n.changeLanguage(language)
      run()
    })
  }
}

afterAll(async () => {
  await i18n.changeLanguage('fr')
})

describe('préréglages de blocage', () => {
  eachLanguage(() => {
    const presets = allPresets()
    expect(presets.length).toBeGreaterThanOrEqual(21)
    for (const preset of presets) {
      expectResolved(preset.title, `titre de ${preset.id}`)
      expectResolved(preset.pitch, `pitch de ${preset.id}`)
      expectResolved(
        preset.config.name as string,
        `nom écrit pour ${preset.id}`,
      )
      expectResolved(presetDetail(preset), `détail de ${preset.id}`)
      for (const line of presetLines(preset)) {
        expectResolved(line.label, `libellé de ligne de ${preset.id}`)
        expectResolved(line.value, `valeur de ligne de ${preset.id}`)
      }
    }
  })
})

describe('fiches « Nouvelle règle »', () => {
  eachLanguage(() => {
    for (const id of Object.keys(NEW_RULE_PRESET_IDS)) {
      for (const part of ['time', 'title', 'description', 'add']) {
        expectResolved(
          translate(`blocking.new_rule.templates.${id}.${part}`),
          `fiche ${id}.${part}`,
        )
      }
    }
  })
})

describe('libellés de règle', () => {
  eachLanguage(() => {
    for (const type of [
      'progressive_delay',
      'schedule',
      'daily_limit',
    ] as const) {
      expectResolved(ruleTypeLabel(type), `type ${type}`)
    }
    // Tous les jours, semaine, week-end, et chaque jour isolé.
    for (const days of [null, [1, 2, 3, 4, 5], [0, 6], [0], [3], [2, 4]]) {
      expectResolved(daysLabel(days), `jours ${JSON.stringify(days)}`)
    }
    for (const count of [0, 1, 2, 7]) {
      expectResolved(appsSubtitle([], count), `sous-titre ${count} apps`)
    }
    expectResolved(appsSubtitle([]), 'sous-titre sans app')
  })
})

describe('questionnaire d’accueil', () => {
  const SECTIONS: Record<string, string[]> = {
    trigger: [
      'time',
      'bed',
      'focus',
      'control',
      'sleep',
      'habit',
      'mood',
      'presence',
      'goals',
    ],
    moment: [
      'bed',
      'wake',
      'work',
      'break',
      'transport',
      'meals',
      'weekend',
      'always',
    ],
    feelings: [
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
    ],
    stolen: [
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
    ],
    attempts: [
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
      'never',
    ],
    aspiration: [
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
    ],
  }

  eachLanguage(() => {
    for (const [section, ids] of Object.entries(SECTIONS)) {
      for (const id of ids) {
        expectResolved(
          translate(`onboarding_survey.${section}.${id}`),
          `réponse ${section}.${id}`,
        )
      }
    }
    for (const estimate of SCREEN_TIME_ESTIMATES) {
      expectResolved(
        translate(`onboarding_survey.screen_time.${estimate.id}`),
        `tranche ${estimate.id}`,
      )
    }
  })
})

describe('plan personnalisé', () => {
  const ANSWERS = {
    trigger: [
      'time',
      'bed',
      'focus',
      'control',
      'sleep',
      'habit',
      'mood',
      'presence',
      'goals',
    ],
    moment: [
      'bed',
      'wake',
      'work',
      'break',
      'transport',
      'meals',
      'weekend',
      'always',
    ],
    feelings: [
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
    ],
    stolen: [
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
    ],
    attempts: [
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
    ],
    aspirations: [
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
    ],
  }

  eachLanguage(() => {
    // Chaque réponse prise SEULE : c'est la seule façon de traverser toutes
    // les branches (le plan n'en cite que deux à la fois).
    for (const trigger of ANSWERS.trigger) {
      for (const moment of ANSWERS.moment) {
        const plan = buildPersonalizedPlan({
          name: 'Léa',
          apps: ['TikTok'],
          moment: [moment],
          trigger: [trigger],
          feelings: [],
          stolen: [],
          attempts: [],
          aspirations: [],
          hours: 5,
        })
        expectResolved(plan.recap, `récap ${trigger}/${moment}`)
        expectResolved(plan.intention, `intention ${trigger}`)
      }
    }
    for (const feeling of ANSWERS.feelings) {
      const plan = buildPersonalizedPlan({
        name: '',
        apps: [],
        moment: [],
        trigger: [],
        feelings: [feeling],
        stolen: [],
        attempts: [],
        aspirations: [],
        hours: 3,
      })
      expectResolved(plan.feeling as string, `ressenti ${feeling}`)
    }
    for (const stolen of ANSWERS.stolen) {
      const plan = buildPersonalizedPlan({
        name: '',
        apps: [],
        moment: [],
        trigger: [],
        feelings: [],
        stolen: [stolen],
        attempts: [],
        aspirations: [],
        hours: 3,
      })
      expectResolved(plan.loss as string, `perte ${stolen}`)
    }
    for (const attempt of ANSWERS.attempts) {
      const plan = buildPersonalizedPlan({
        name: '',
        apps: [],
        moment: [],
        trigger: [],
        feelings: [],
        stolen: [],
        attempts: [attempt],
        aspirations: [],
        hours: 3,
      })
      expectResolved(plan.defense as string, `méthode tentée ${attempt}`)
    }
    for (const aspiration of ANSWERS.aspirations) {
      const plan = buildPersonalizedPlan({
        name: '',
        apps: [],
        moment: [],
        trigger: [],
        feelings: [],
        stolen: [],
        attempts: [],
        aspirations: [aspiration],
        hours: 3,
      })
      expectResolved(plan.aspirationSummary as string, `envie ${aspiration}`)
      for (const word of plan.aspirationWords) {
        expectResolved(word, `mot défilant ${aspiration}`)
      }
    }
    // Aucune réponse : le repli doit lui aussi être traduit.
    const empty = buildPersonalizedPlan({
      name: '',
      apps: [],
      moment: [],
      trigger: [],
      feelings: [],
      stolen: [],
      attempts: [],
      aspirations: [],
      hours: 4,
    })
    expectResolved(empty.recap, 'récap sans réponse')
    expectResolved(empty.intention, 'intention par défaut')
    for (const word of empty.aspirationWords) {
      expectResolved(word, 'mot défilant par défaut')
    }
  })
})

describe('catalogue de notifications', () => {
  // On APPELLE `content()` au lieu de reconstruire la clé depuis l'identifiant
  // du nœud : `score.weakest_axis_tip` produit `…_focus` ou `…_rest` selon le
  // contexte, et une clé devinée ne teste pas ce que le moteur envoie vraiment.
  // Le contexte est balayé pour traverser les deux branches.
  const CONTEXTS = [
    context(),
    context({ score: { ...context().score, weakestAxis: 'rest' } }),
    context({ score: { ...context().score, weakestAxis: 'focus' } }),
  ]

  eachLanguage(() => {
    expect(NOTIF_CATALOG.length).toBeGreaterThan(30)
    for (const node of NOTIF_CATALOG) {
      for (const variant of node.variants ?? [null]) {
        for (const ctx of CONTEXTS) {
          const spec = node.content(ctx, {
            variant,
            groupSize: 1,
          } as Parameters<typeof node.content>[1])
          for (const key of [spec.titleKey, spec.bodyKey]) {
            expectResolved(
              translate(key, spec.params ?? {}),
              `notification ${node.id}${variant ? `_${variant}` : ''}`,
            )
          }
        }
      }
    }
  })
})

describe('familles restantes', () => {
  eachLanguage(() => {
    const families: Record<string, string[]> = {
      'add_rule.types': [
        'block_now.title',
        'block_now.desc',
        'schedule.title',
        'schedule.desc',
        'daily_limit.title',
        'daily_limit.desc',
      ],
      'add_rule.days': ['every_day', 'weekdays', 'weekend'],
      'blocking.days.short': ['0', '1', '2', '3', '4', '5', '6'],
      'onboarding_picker.category': [
        'all',
        'social',
        'games',
        'fun',
        'creative',
        'reading',
        'shopping',
        'work',
      ],
      onboarding_plan_actions: [
        'block.title',
        'pause.title',
        'progress.title',
        'block.preparing',
        'pause.preparing',
        'progress.preparing',
      ],
      onboarding_ritual: [
        'idle.title',
        'idle.sub',
        'hold.title',
        'hold.sub',
        'paused.title',
        'paused.sub',
        'sealed.title',
        'sealed.sub',
      ],
      'onboarding_verdict.press': [
        'meta.quote',
        'meta.source',
        'meta.context',
        'trial.quote',
        'trial.source',
        'trial.context',
        'tiktok.quote',
        'tiktok.source',
        'tiktok.context',
      ],
      'onboarding_intro.proof.benefit': [
        'focus.lead',
        'focus.rest',
        'time.lead',
        'time.rest',
        'presence.lead',
        'presence.rest',
      ],
      'onboarding_plan.default_word': [
        'presence',
        'sleep',
        'calm',
        'freedom',
        'life',
      ],
      paywall_reference: [
        'benefit_focus_title',
        'benefit_focus_body',
        'benefit_time_title',
        'benefit_time_body',
        'benefit_presence_title',
        'benefit_presence_body',
        'testimonial_2',
        'testimonial_3',
        'author_2',
        'author_3',
      ],
    }
    for (const [prefix, suffixes] of Object.entries(families)) {
      for (const suffix of suffixes) {
        expectResolved(translate(`${prefix}.${suffix}`), `${prefix}.${suffix}`)
      }
    }
  })
})
