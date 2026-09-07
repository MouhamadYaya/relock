/**
 * Signaux produit consommés par le moteur.
 *
 * Séparer « l'événement » de « la notification » suppose que l'événement
 * existe quelque part. Ce module est cet endroit : un petit journal local que
 * le reste de l'app alimente au moment où les faits se produisent (le paywall
 * se referme, un essai est connu, une extension donne signe de vie), et que le
 * contexte relit ensuite.
 *
 * Rien de sensible n'y transite : des horodatages et des booléens.
 */
import { kvStorage } from '@/shared/services/storage/mmkv'
import { creditActionAfterTap } from './fatigue'
import { readEngineState, writeEngineState } from './state'

const KEY = 'notif.signals.v1'

export interface NotifSignals {
  /** Feuille de paiement présentée puis annulée (epoch ms). */
  paywallAbandonedAt: number | null
  /** Échéance de l'offre en cours (epoch ms) — instant absolu. */
  offerExpiresAt: number | null
  offerAvailable: boolean
  /** Fin de période d'essai (epoch ms). */
  trialEndsAt: number | null
  renewalIssue: boolean
  entitlementLostAt: number | null
  /** Au moins une règle a déjà réellement protégé. */
  hasEverArmed: boolean
  /** Depuis quand plus aucune règle n'est active (epoch ms). */
  noActiveRuleSince: number | null
  /** Une session stricte a été menée jusqu'au bout. */
  strictEverCompleted: boolean
  /** Début du verrou strict en cours (epoch ms). */
  strictStartedAt: number | null
  /** Dernière synchronisation réussie du journal d'événements (epoch ms). */
  lastSyncAt: number | null
  /** Heure à risque déclarée à l'accueil (minutes depuis minuit). */
  riskHourMinutes: number | null
  /** Prolongations manuelles, horodatées (7 jours glissants). */
  extensions: number[]
  /** Meilleure semaine connue, en minutes regagnées. */
  bestWeekMinutes: number
  /** Dernier rang de palier de score annoncé. */
  previousBandRank: number | null
  /** Défi (règle à durée de vie) mené à son terme. */
  challengeCompletedAt: number | null
  challengeDays: number
}

const EMPTY: NotifSignals = {
  paywallAbandonedAt: null,
  offerExpiresAt: null,
  offerAvailable: false,
  trialEndsAt: null,
  renewalIssue: false,
  entitlementLostAt: null,
  hasEverArmed: false,
  noActiveRuleSince: null,
  strictEverCompleted: false,
  strictStartedAt: null,
  lastSyncAt: null,
  riskHourMinutes: null,
  extensions: [],
  bestWeekMinutes: 0,
  previousBandRank: null,
  challengeCompletedAt: null,
  challengeDays: 0,
}

const DAY_MS = 86_400_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export function readSignals(): NotifSignals {
  const raw = kvStorage.getString(KEY)
  if (!raw) return { ...EMPTY }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { ...EMPTY }
    return {
      paywallAbandonedAt: num(parsed.paywallAbandonedAt),
      offerExpiresAt: num(parsed.offerExpiresAt),
      offerAvailable: parsed.offerAvailable === true,
      trialEndsAt: num(parsed.trialEndsAt),
      renewalIssue: parsed.renewalIssue === true,
      entitlementLostAt: num(parsed.entitlementLostAt),
      hasEverArmed: parsed.hasEverArmed === true,
      noActiveRuleSince: num(parsed.noActiveRuleSince),
      strictEverCompleted: parsed.strictEverCompleted === true,
      strictStartedAt: num(parsed.strictStartedAt),
      lastSyncAt: num(parsed.lastSyncAt),
      riskHourMinutes: num(parsed.riskHourMinutes),
      extensions: Array.isArray(parsed.extensions)
        ? parsed.extensions.filter((v): v is number => typeof v === 'number')
        : [],
      bestWeekMinutes: num(parsed.bestWeekMinutes) ?? 0,
      previousBandRank: num(parsed.previousBandRank),
      challengeCompletedAt: num(parsed.challengeCompletedAt),
      challengeDays: num(parsed.challengeDays) ?? 0,
    }
  } catch {
    return { ...EMPTY }
  }
}

export function writeSignals(patch: Partial<NotifSignals>): NotifSignals {
  const next = { ...readSignals(), ...patch }
  kvStorage.setString(KEY, JSON.stringify(next))
  return next
}

export function clearSignals(): void {
  kvStorage.delete(KEY)
}

// ─────────────────────────────────────────────────────────────────────
// Points d'accroche appelés par le reste de l'app
// ─────────────────────────────────────────────────────────────────────

/**
 * Le paywall s'est refermé sans achat, feuille de paiement effectivement
 * présentée. C'est le seul abandon qui compte : fermer un écran de prix qu'on
 * n'a jamais eu l'intention d'acheter n'est pas un abandon de paiement.
 */
export const notePaywallAbandoned = (now: number): void => {
  writeSignals({ paywallAbandonedAt: now })
}

export const noteEntitled = (trialEndsAt: number | null): void => {
  writeSignals({
    entitlementLostAt: null,
    paywallAbandonedAt: null,
    renewalIssue: false,
    trialEndsAt,
  })
}

export const noteEntitlementLost = (now: number): void => {
  const current = readSignals()
  // On ne réécrit pas la date à chaque lancement : « perdu depuis » doit
  // rester la date de la perte, pas celle du dernier démarrage.
  if (current.entitlementLostAt === null) {
    writeSignals({ entitlementLostAt: now, trialEndsAt: null })
  }
}

export const noteRenewalIssue = (issue: boolean): void => {
  writeSignals({ renewalIssue: issue })
}

/** Ouverture d'un cycle d'offre : c'est ICI que naît la deadline. */
export const noteOfferOpened = (expiresAt: number | null): void => {
  writeSignals({
    offerAvailable: expiresAt !== null,
    offerExpiresAt: expiresAt,
  })
}

export const noteOfferClosed = (): void => {
  writeSignals({ offerAvailable: false, offerExpiresAt: null })
}

export const noteRuleArmed = (now: number): void => {
  writeSignals({
    hasEverArmed: true,
    noActiveRuleSince: null,
    strictStartedAt: now,
  })
}

export const noteExtensionUsed = (now: number): void => {
  const current = readSignals()
  writeSignals({
    extensions: [...current.extensions, now].filter(
      at => now - at <= 7 * DAY_MS,
    ),
  })
}

export const noteSynced = (now: number): void => {
  writeSignals({ lastSyncAt: now })
}

export const noteRiskHour = (minutes: number | null): void => {
  writeSignals({ riskHourMinutes: minutes })
}

/**
 * Un défi est allé à son terme. On passe par un signal plutôt que d'envoyer la
 * notification sur place : une félicitation reste soumise au canal, aux heures
 * calmes et au budget comme n'importe quel autre message. Une notification qui
 * court-circuite le moteur est une notification que personne ne peut éteindre.
 */
export const noteChallengeCompleted = (now: number, days: number): void => {
  writeSignals({ challengeCompletedAt: now, challengeDays: days })
}
