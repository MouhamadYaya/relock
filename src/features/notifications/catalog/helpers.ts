/**
 * Outils du catalogue. Tout est PUR et prend `now` en paramètre : aucun nœud
 * ne lit l'horloge, ce qui rend le catalogue entier testable à date fixe.
 */
import type {
  NotifDefinition,
  NotifRoute,
  NotifRouteGuard,
  NotifSchedule,
} from '@/features/notifications/types'

export const MINUTE = 60_000
export const HOUR = 3_600_000
export const DAY = 86_400_000

/**
 * Prochaine occurrence d'une heure LOCALE.
 *
 * `weekday` suit JavaScript (0 = dimanche) — la conversion vers la convention
 * Apple (1 = dimanche) se fait au moment de parler au natif, pas ici.
 */
export function nextOccurrence(
  now: number,
  hour: number,
  minute: number,
  options: { weekday?: number; day?: number } = {},
): number {
  const d = new Date(now)
  d.setHours(hour, minute, 0, 0)

  if (options.day !== undefined) {
    d.setDate(options.day)
    if (d.getTime() <= now) d.setMonth(d.getMonth() + 1)
    return d.getTime()
  }

  if (options.weekday !== undefined) {
    const shift = (options.weekday - d.getDay() + 7) % 7
    d.setDate(d.getDate() + shift)
    if (d.getTime() <= now) d.setDate(d.getDate() + 7)
    return d.getTime()
  }

  if (d.getTime() <= now) d.setDate(d.getDate() + 1)
  return d.getTime()
}

/**
 * Heure locale. « Dimanche 19h » reste 19h après un vol Montréal → Paris,
 * parce que le natif l'exprimera en composantes de calendrier et non en délai.
 */
export function wallClock(
  now: number,
  spec: {
    hour: number
    minute: number
    weekday?: number
    day?: number
    repeats?: boolean
  },
): NotifSchedule {
  return {
    kind: 'wallClock',
    hour: spec.hour,
    minute: spec.minute,
    weekday: spec.weekday,
    day: spec.day,
    repeats: spec.repeats,
    at: nextOccurrence(now, spec.hour, spec.minute, {
      weekday: spec.weekday,
      day: spec.day,
    }),
  }
}

/**
 * Instant MONDIAL. Une fin d'essai ne se décale pas de six heures parce qu'on
 * a changé de fuseau : c'est un instant, pas une heure.
 */
export function absolute(at: number): NotifSchedule {
  return { kind: 'absolute', at }
}

/** Délai depuis maintenant, ou depuis un événement daté. */
export function relative(at: number): NotifSchedule {
  return { kind: 'relative', at }
}

/**
 * Dead man's switch : armé à l'avance, désarmé à chaque passage sain. Le seul
 * mécanisme capable de parler quand l'app n'est plus jamais ouverte.
 */
export function watchdog(at: number): NotifSchedule {
  return { kind: 'watchdog', at }
}

/** Aucun tir avant cet instant — évite une notification « dans 3 secondes ». */
export function notBefore(at: number, floor: number): number {
  return Math.max(at, floor)
}

export function route(
  pathname: string,
  extra: Partial<Omit<NotifRoute, 'pathname'>> = {},
): NotifRoute {
  return { pathname, ...extra }
}

/**
 * Garde partagé de tous les nœuds commerciaux : ne JAMAIS ouvrir le paywall à
 * quelqu'un qui s'est abonné entre la planification et le tap. C'est le cas
 * que le routage naïf rate systématiquement, et il se produit chaque fois que
 * la notification a fait son travail.
 */
export const notEntitled: NotifRouteGuard = ctx => !ctx.entitled

/**
 * Garde des nœuds qui visent une règle précise : elle a pu être supprimée
 * entre la planification et le tap. L'identifiant est relu dans la charge
 * utile, seul endroit où il ait survécu au voyage par le système.
 */
export const ruleStillExists: NotifRouteGuard = (ctx, payload) => {
  const id = payload.r.q?.id
  return typeof id === 'string' && ctx.ruleIds.includes(id)
}

/** Clé i18n d'un nœud : `notifications.<famille>.<nœud>.<title|body>`. */
export function contentKeys(
  id: string,
  variant?: string | null,
): { titleKey: string; bodyKey: string } {
  const suffix = variant ? `_${variant}` : ''
  return {
    titleKey: `notifications.${id}.title${suffix}`,
    bodyKey: `notifications.${id}.body${suffix}`,
  }
}

/**
 * Valeurs par défaut du boilerplate. Ce qui reste explicite dans chaque nœud
 * est exactement ce qui mérite d'être lu et discuté : priorité, éligibilité,
 * instant, canal, détectabilité.
 */
export function defineNode(
  definition: Omit<NotifDefinition, 'quietHours' | 'cooldownDays'> &
    Partial<Pick<NotifDefinition, 'quietHours' | 'cooldownDays'>>,
): NotifDefinition {
  return {
    quietHours: 'strict',
    cooldownDays: 1,
    emitter: 'engine',
    ...definition,
  }
}

/** Cooldown « une seule fois dans la vie de l'app ». */
export const ONCE_EVER_DAYS = 3650
