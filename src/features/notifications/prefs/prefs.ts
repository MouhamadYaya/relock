/**
 * Préférences de notifications v2 — des CANAUX, pas trois booléens.
 *
 * Deux principes non négociables :
 *
 *  1. `offers` est OPT-IN (faux par défaut). Le contenu promotionnel exige un
 *     consentement explicite ; le mettre à vrai « par défaut » reviendrait à
 *     déduire un accord qui n'a jamais été donné.
 *  2. Les alertes de PROTECTION ne passent par aucun canal et survivent à
 *     l'interrupteur maître. C'est un choix assumé, et l'écran Réglages le dit
 *     mot pour mot : un interrupteur qui ment est pire que pas d'interrupteur.
 */
import { constants } from '@/config/constants'
import type {
  NotifChannel,
  NotifPrefs,
  NotifRitualContext,
  QuietHours,
} from '@/features/notifications/types'
import { kvStorage } from '@/shared/services/storage/mmkv'

/** Fenêtre de silence appliquée quand l'utilisateur n'a rien choisi. */
export const DEFAULT_QUIET_HOURS: QuietHours = {
  startMinutes: 22 * 60,
  endMinutes: 8 * 60,
}

const DEFAULT_RITUAL: NotifRitualContext = {
  myMomentMinutes: null,
  bedtimeMinutes: null,
  morningMinutes: null,
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  version: 2,
  master: true,
  channels: {
    reminders: true,
    progression: true,
    account: true,
    // Promotionnel ⇒ opt-in. Voir en-tête.
    offers: false,
    // Le rituel n'existe pas tant que l'utilisateur n'a pas choisi son heure.
    ritual: false,
  },
  quietHours: null,
  ritual: DEFAULT_RITUAL,
}

interface LegacyPrefs {
  master?: boolean
  reminders?: boolean
  progression?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readMinutes(value: unknown): number | null {
  return typeof value === 'number' && value >= 0 && value < 1440
    ? Math.round(value)
    : null
}

function readQuietHours(value: unknown): QuietHours | null {
  if (!isRecord(value)) return null
  const start = readMinutes(value.startMinutes)
  const end = readMinutes(value.endMinutes)
  // Une fenêtre vide (début = fin) ne veut rien dire : on retombe sur le défaut
  // plutôt que de faire taire l'app 24 h ou 0 h selon l'interprétation.
  if (start === null || end === null || start === end) return null
  return { startMinutes: start, endMinutes: end }
}

function readRitual(value: unknown): NotifRitualContext {
  if (!isRecord(value)) return { ...DEFAULT_RITUAL }
  return {
    myMomentMinutes: readMinutes(value.myMomentMinutes),
    bedtimeMinutes: readMinutes(value.bedtimeMinutes),
    morningMinutes: readMinutes(value.morningMinutes),
  }
}

function parse(raw: string): NotifPrefs | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    const channels = isRecord(parsed.channels) ? parsed.channels : {}
    return {
      version: 2,
      master: readBool(parsed.master, DEFAULT_NOTIF_PREFS.master),
      channels: {
        reminders: readBool(channels.reminders, true),
        progression: readBool(channels.progression, true),
        account: readBool(channels.account, true),
        offers: readBool(channels.offers, false),
        ritual: readBool(channels.ritual, false),
      },
      quietHours: readQuietHours(parsed.quietHours),
      ritual: readRitual(parsed.ritual),
    }
  } catch {
    return null
  }
}

/**
 * Migration v1 → v2, jouée une seule fois.
 *
 * `offers` ne peut PAS hériter de `reminders` : personne n'a jamais consenti à
 * du promotionnel en cochant « rappels ». Il démarre donc à faux, même pour un
 * utilisateur qui avait tout activé.
 */
function migrateLegacy(): NotifPrefs | null {
  const raw = kvStorage.getString(constants.NOTIF_PREFS_LEGACY)
  if (!raw) return null
  let legacy: LegacyPrefs = {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isRecord(parsed)) legacy = parsed as LegacyPrefs
  } catch {
    // Illisible : on repart des défauts plutôt que de perdre l'utilisateur.
  }
  const migrated: NotifPrefs = {
    ...DEFAULT_NOTIF_PREFS,
    master: readBool(legacy.master, true),
    channels: {
      reminders: readBool(legacy.reminders, true),
      progression: readBool(legacy.progression, true),
      account: true,
      offers: false,
      ritual: false,
    },
  }
  kvStorage.setString(constants.NOTIF_PREFS, JSON.stringify(migrated))
  kvStorage.delete(constants.NOTIF_PREFS_LEGACY)
  return migrated
}

export function getNotifPrefs(): NotifPrefs {
  const raw = kvStorage.getString(constants.NOTIF_PREFS)
  if (raw) {
    const parsed = parse(raw)
    if (parsed) return parsed
  }
  return migrateLegacy() ?? { ...DEFAULT_NOTIF_PREFS }
}

export function setNotifPrefs(prefs: NotifPrefs): void {
  kvStorage.setString(constants.NOTIF_PREFS, JSON.stringify(prefs))
}

export function updateNotifPrefs(patch: Partial<NotifPrefs>): NotifPrefs {
  const next: NotifPrefs = { ...getNotifPrefs(), ...patch, version: 2 }
  setNotifPrefs(next)
  return next
}

export function setChannel(
  channel: NotifChannel,
  enabled: boolean,
): NotifPrefs {
  const current = getNotifPrefs()
  return updateNotifPrefs({
    channels: { ...current.channels, [channel]: enabled },
  })
}

/**
 * La fenêtre EFFECTIVE. Le réglage utilisateur REMPLACE le défaut, il ne s'y
 * ajoute pas : quelqu'un qui choisit 23h–7h doit être notifiable à 22h30,
 * sinon son réglage ne sert à rien.
 */
export function effectiveQuietHours(prefs: NotifPrefs): QuietHours {
  return prefs.quietHours ?? DEFAULT_QUIET_HOURS
}

/** Soft-ask : la permission n'est demandée qu'une fois, au bon moment. */
export const hasAskedNotifPermission = (): boolean =>
  kvStorage.getString(constants.NOTIF_PERMISSION_ASKED) === '1'

export const markNotifPermissionAsked = (): void =>
  kvStorage.setString(constants.NOTIF_PERMISSION_ASKED, '1')
