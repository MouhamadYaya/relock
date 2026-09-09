import {
  type HapticEvent,
  isSupported,
  trigger,
  triggerPattern,
} from 'react-native-haptic-feedback'
import { getPreference } from '@/shared/services/storage/app-preferences'

/**
 * La partition haptique de Relock.
 *
 * ── Pourquoi une partition, et pas les types tout faits de la librairie ──
 *
 * Les constantes de `react-native-haptic-feedback` sont un plus petit commun
 * dénominateur : `selection` y vaut `intensity 0.2 / sharpness 0.5`, le plus
 * FAIBLE événement de toute sa table. Posé sous le doigt d'un utilisateur qui
 * marche, téléphone dans une coque, il ne se sent tout simplement pas — et une
 * app qui ne répond pas au toucher se lit comme une app lente, jamais comme une
 * app sobre.
 *
 * On passe donc par Core Haptics (`triggerPattern`), qui expose les deux seuls
 * paramètres qui comptent :
 *
 * - `intensity` — la FORCE perçue. Elle dit l'importance de ce qui vient de se
 *   passer. C'est la hiérarchie : effleurer une carte ≠ sceller un engagement.
 * - `sharpness` — le TIMBRE. À 0 le moteur rend un coup rond et sourd ; à 1 un
 *   claquement sec. C'est là que se joue le « premium » : le bon marché, c'est
 *   sec ET fort. Le haut de gamme, c'est présent et ROND — intensité franche,
 *   netteté basse. Toute la carte ci-dessous tient dans cette phrase.
 *
 * Le moteur Core Haptics est pré-chauffé au démarrage du module natif, donc la
 * toute première frappe n'a pas de retard perceptible.
 *
 * ── Repli ──
 *
 * Sans Core Haptics (iPhone 7 et antérieurs — hors cible iOS 16+, mais aussi
 * tout appareil Android au moteur pauvre), `triggerPattern` ne jouerait RIEN.
 * Chaque signature déclare donc le type historique le plus proche, joué à sa
 * place. Un retour dégradé vaut infiniment mieux qu'un silence.
 */

/** Un temps de la partition. `time` en millisecondes depuis le début. */
function beat(time: number, intensity: number, sharpness: number): HapticEvent {
  return { time, type: 'transient', intensity, sharpness }
}

/** Une vibration tenue — la seule façon de rendre une matière, pas un choc. */
function hold(
  time: number,
  duration: number,
  intensity: number,
  sharpness: number,
): HapticEvent {
  return { time, type: 'continuous', duration, intensity, sharpness }
}

type FallbackType =
  | 'selection'
  | 'soft'
  | 'impactLight'
  | 'impactMedium'
  | 'impactHeavy'
  | 'rigid'
  | 'notificationSuccess'
  | 'notificationWarning'
  | 'notificationError'

interface Signature {
  events: readonly HapticEvent[]
  /** Joué tel quel quand Core Haptics est absent. */
  fallback: FallbackType
  /**
   * Poids dans la hiérarchie, de 1 (effleurement) à 5 (engagement).
   * Sert à départager deux signaux qui tombent dans la même fenêtre — voir
   * `COALESCE_MS`.
   */
  weight: number
  /**
   * Un signal de SÉCURITÉ : il doit se sentir même moteur haptique éteint au
   * niveau système, quitte à passer par le vibreur. Réservé aux actions
   * irréversibles et aux refus — jamais au décor.
   */
  forceful?: boolean
  /**
   * Un signal RYTHMIQUE, cadencé par l'appelant (le martèlement d'un maintien,
   * les crans d'un sélecteur qu'on fait défiler vite). Il échappe à la fenêtre
   * de coalescence : sa répétition rapprochée est l'effet recherché, pas un
   * doublon accidentel.
   */
  rhythmic?: boolean
}

/**
 * ── La carte ──
 *
 * Lue de haut en bas, elle monte : effleurement, choix, appui, engagement.
 * Deux gestes de même poids doivent se ressembler, deux gestes de poids
 * différents doivent se distinguer les yeux fermés. C'est tout le contrat.
 */
const SIGNATURES = {
  /**
   * Le toucher standard : une carte, une ligne, une tuile, une icône de barre.
   * Rond et franc — présent sous le doigt, jamais claquant. C'est le retour
   * que l'app émet des centaines de fois par jour : il doit rester agréable à
   * la millième frappe, donc doux.
   */
  tap: { events: [beat(0, 0.5, 0.22)], fallback: 'soft', weight: 2 },

  /**
   * L'effleurement : un élément secondaire, une puce, un chevron, une carte
   * qu'on ouvre pour lire. Volontairement en dessous de `tap` — tout ne peut
   * pas être important, sinon plus rien ne l'est.
   */
  graze: { events: [beat(0, 0.32, 0.2)], fallback: 'soft', weight: 1 },

  /**
   * Le choix : un item d'une liste, un segment, un cran de sélecteur. Sec et
   * court — le tic mécanique d'une molette. Netteté haute ASSUMÉE : ici le
   * doigt cherche une frontière, pas une caresse.
   */
  select: { events: [beat(0, 0.42, 0.62)], fallback: 'selection', weight: 2 },

  /**
   * L'appui sur un bouton d'action : ouvrir une feuille, lancer un écran,
   * confirmer un choix intermédiaire. Un cran au-dessus du toucher.
   */
  press: { events: [beat(0, 0.68, 0.34)], fallback: 'impactLight', weight: 3 },

  /**
   * L'engagement : créer la règle, valider, payer. Deux temps qui MONTENT —
   * l'oreille interne lit une montée comme un départ, une descente comme une
   * fin. C'est le « c'est parti » de l'app.
   */
  commit: {
    events: [beat(0, 0.55, 0.28), beat(70, 0.95, 0.45)],
    fallback: 'impactMedium',
    weight: 4,
  },

  /** Interrupteur allumé : la même montée, en plus court. */
  toggleOn: {
    events: [beat(0, 0.4, 0.2), beat(45, 0.75, 0.4)],
    fallback: 'impactMedium',
    weight: 3,
  },

  /** Interrupteur éteint : la montée jouée à l'envers, et ça s'entend. */
  toggleOff: {
    events: [beat(0, 0.75, 0.4), beat(45, 0.4, 0.2)],
    fallback: 'impactLight',
    weight: 3,
  },

  /**
   * C'est fait. Une note douce, un silence, une note pleine : le rythme
   * universel de la réussite. Le silence de 90 ms fait tout le travail — sans
   * lui, les deux temps fusionnent en un simple coup.
   */
  success: {
    events: [beat(0, 0.5, 0.25), beat(90, 0.9, 0.4)],
    fallback: 'notificationSuccess',
    weight: 4,
  },

  /** Attention. Deux temps ÉGAUX : ni montée ni descente, on suspend. */
  warning: {
    events: [beat(0, 0.75, 0.5), beat(140, 0.75, 0.5)],
    fallback: 'notificationWarning',
    weight: 4,
    forceful: true,
  },

  /** Refus. Trois coups secs et serrés — le seul endroit où l'app claque. */
  error: {
    events: [beat(0, 0.9, 0.75), beat(85, 0.9, 0.75), beat(170, 0.9, 0.75)],
    fallback: 'notificationError',
    weight: 5,
    forceful: true,
  },

  /**
   * La porte se ferme : le blocage vient de prendre effet. Une matière tenue
   * qui se resserre, puis le pêne. Le geste le plus identitaire de Relock —
   * c'est littéralement le nom du produit sous le doigt.
   */
  lock: {
    events: [hold(0, 130, 0.45, 0.15), beat(150, 1, 0.6)],
    fallback: 'impactHeavy',
    weight: 5,
    forceful: true,
  },

  /** La porte s'ouvre : le pêne d'abord, puis le relâchement. */
  unlock: {
    events: [beat(0, 0.85, 0.55), hold(60, 160, 0.35, 0.12)],
    fallback: 'impactMedium',
    weight: 4,
    forceful: true,
  },

  /**
   * Un cran de molette : le sélecteur d'heure, de durée, la roue d'icônes.
   *
   * Léger et sec — il doit tenir la rafale sans fatiguer, parce qu'on en
   * traverse trente en un geste. Rythmique : c'est le doigt qui en fixe la
   * cadence, chaque cran franchi doit s'entendre, et deux crans rapprochés ne
   * sont pas un doublon accidentel mais un défilement rapide.
   */
  detent: {
    events: [beat(0, 0.38, 0.66)],
    fallback: 'selection',
    weight: 2,
    rhythmic: true,
  },

  /**
   * Un coup lourd et unique. Le plus fort de la carte à ne durer qu'un temps :
   * là où `lock` raconte une porte qui se ferme, celui-ci ne fait que frapper.
   * C'est ce qu'il faut quand le rythme vient d'ailleurs (un martèlement, un
   * palier atteint) et que la signature ne doit pas empiéter sur le temps
   * suivant.
   */
  strike: { events: [beat(0, 1, 0.55)], fallback: 'impactHeavy', weight: 4 },

  /**
   * Un seuil franchi pendant un geste continu : la barre du maintien qui
   * atteint son point de non-retour, un palier de compteur. Bref et net,
   * parce qu'il arrive PENDANT que le doigt travaille.
   */
  threshold: { events: [beat(0, 0.6, 0.7)], fallback: 'rigid', weight: 3 },
} as const satisfies Record<string, Signature>

export type HapticSignal = keyof typeof SIGNATURES

const gentle = {
  enableVibrateFallback: false,
  ignoreAndroidSystemSettings: false,
} as const

/**
 * Les signaux de sécurité doivent se sentir même sans moteur haptique : on
 * autorise le repli sur le vibreur et on ignore le réglage système. C'est un
 * avertissement, pas une coquetterie.
 */
const insistent = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true,
} as const

/**
 * Core Haptics est une caractéristique du MATÉRIEL : elle ne change pas en
 * cours de session, on ne la demande donc qu'une fois. `null` = pas encore su.
 */
let coreHaptics: boolean | null = null

function hasCoreHaptics(): boolean {
  if (coreHaptics === null) {
    try {
      coreHaptics = isSupported()
    } catch {
      coreHaptics = false
    }
  }
  return coreHaptics
}

/**
 * Deux vibrations à moins de 40 ms ne s'entendent pas comme deux : le moteur
 * n'a pas fini son premier mouvement que le second l'écrase, et on ne sent
 * plus qu'une bouillie tiède. Or ce cas est FRÉQUENT — un `onPressIn` qui
 * accuse le toucher, puis le résultat de l'action 20 ms plus tard.
 *
 * Dans cette fenêtre, un seul signal passe : le plus lourd. Le retour du
 * résultat prime donc sur l'accusé de réception, ce qui est le bon ordre —
 * l'utilisateur veut savoir CE QUI S'EST PASSÉ, pas qu'il a touché l'écran.
 *
 * 40 ms reste très en dessous de l'écart entre deux crans d'un sélecteur
 * (~80 ms au plus vif) : les retours à répétition voulus passent tous.
 */
const COALESCE_MS = 40

let lastPlayedAt = 0
let lastWeight = 0

/**
 * Oublie tout ce que le module a retenu — la fenêtre de coalescence et la
 * capacité matérielle. Réservé aux tests : en production, ni l'une ni l'autre
 * n'a de raison d'être remise à zéro en cours de session.
 */
export function resetHapticsMemory(): void {
  lastPlayedAt = 0
  lastWeight = 0
  coreHaptics = null
}

function emit(signature: Signature): void {
  // Réglages → « Retours haptiques ». Lu à CHAQUE frappe, jamais mis en cache :
  // la bascule doit se sentir immédiatement, sans redémarrage.
  if (!getPreference('haptics')) return

  if (!signature.rhythmic) {
    const now = Date.now()
    if (now - lastPlayedAt < COALESCE_MS && signature.weight <= lastWeight) {
      return
    }
    lastPlayedAt = now
    lastWeight = signature.weight
  }

  const options = signature.forceful ? insistent : gentle
  try {
    if (hasCoreHaptics()) triggerPattern([...signature.events], options)
    else trigger(signature.fallback, options)
  } catch {
    // Un retour haptique ne doit JAMAIS interrompre l'interaction principale.
  }
}

function play(signal: HapticSignal): void {
  emit(SIGNATURES[signal])
}

/** Ramène une progression quelconque dans `[0, 1]`. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export const haptics = {
  /** Une carte, une ligne, une tuile : le toucher standard de l'app. */
  tap: () => play('tap'),
  /** Un élément secondaire — plus discret que `tap`. */
  graze: () => play('graze'),
  /** Un choix dans une liste, un segment. */
  select: () => play('select'),
  /** Un cran franchi dans une molette qui défile. */
  detent: () => play('detent'),
  /** Un bouton d'action : ouvrir, lancer, confirmer une étape. */
  press: () => play('press'),
  /** Créer, valider, s'engager. */
  commit: () => play('commit'),
  /** Un interrupteur. */
  toggle: (on: boolean) => play(on ? 'toggleOn' : 'toggleOff'),
  /** L'opération a abouti. */
  success: () => play('success'),
  /** Il faut faire attention. */
  warning: () => play('warning'),
  /** C'est refusé, ou ça a échoué. */
  error: () => play('error'),
  /** Le blocage prend effet. */
  lock: () => play('lock'),
  /** Le blocage est levé. */
  unlock: () => play('unlock'),
  /** Un seuil franchi pendant un geste continu. */
  threshold: () => play('threshold'),
  /**
   * Le souffle qui accompagne une phase de respiration guidée.
   *
   * `rising` à l'inspiration, `false` à l'expiration — et les deux ne se
   * sentent PAS pareil : trois segments tenus dont l'intensité enfle, puis les
   * mêmes joués à l'envers. C'est le seul retour de l'app qui ne répond à
   * aucun geste ; il ne signale rien, il donne le rythme, et le sens de la
   * rampe est toute l'information qu'il porte. Le regard peut quitter l'écran,
   * la respiration continue de se guider au poignet.
   *
   * Sourd jusqu'à l'extrême (`sharpness` 0.05) et bref au regard de la phase
   * qu'il ouvre : une vibration sèche, ou tenue trois secondes, ferait l'exact
   * contraire de ce que l'écran demande.
   */
  breathe: (rising = true) => {
    const ramp = rising ? [0.16, 0.28, 0.4] : [0.4, 0.28, 0.16]
    emit({
      events: ramp.map((intensity, index) =>
        hold(index * 150, 150, intensity, 0.05),
      ),
      fallback: 'soft',
      weight: 1,
      rhythmic: true,
    })
  },
  /** Un coup lourd et unique, quand le rythme vient d'ailleurs. */
  strike: () => play('strike'),

  /**
   * Un coup du martèlement qui accompagne un maintien, à la progression
   * donnée (`0` au tout début, `1` à l'instant du déclenchement).
   *
   * L'intensité ET la netteté montent ensemble : le geste commence sourd et
   * finit sec. C'est ce que fait une matière qu'on force — elle ne devient pas
   * seulement plus forte, elle devient plus DURE. Un martèlement d'intensité
   * constante se lit comme une alarme ; celui-ci se lit comme un effort dont on
   * approche du bout, et c'est cette montée qui donne envie de tenir.
   */
  rumble: (progress: number) => {
    const p = clamp01(progress)
    emit({
      events: [beat(0, 0.55 + 0.45 * p, 0.3 + 0.55 * p)],
      fallback: p > 0.62 ? 'rigid' : 'impactHeavy',
      weight: 4,
      forceful: true,
      rhythmic: true,
    })
  },
}
