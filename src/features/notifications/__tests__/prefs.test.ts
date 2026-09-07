/**
 * Préférences — deux promesses à ne jamais casser : le promotionnel est
 * opt-in, et la fenêtre de silence choisie REMPLACE le défaut.
 */
import { constants } from '@/config/constants'
import {
  isWithinQuietHours,
  shiftOutOfQuietHours,
} from '@/features/notifications/engine/quiet-hours'
import {
  DEFAULT_QUIET_HOURS,
  effectiveQuietHours,
  getNotifPrefs,
  setChannel,
  setNotifPrefs,
} from '@/features/notifications/prefs/prefs'
import { kvStorage } from '@/shared/services/storage/mmkv'

beforeEach(() => {
  kvStorage.delete(constants.NOTIF_PREFS)
  kvStorage.delete(constants.NOTIF_PREFS_LEGACY)
})

it('démarre avec les offres DÉSACTIVÉES', () => {
  // Notifier une promotion sans accord explicite est ce qu'Apple sanctionne,
  // et ce que personne n'apprécie.
  expect(getNotifPrefs().channels.offers).toBe(false)
  expect(getNotifPrefs().channels.reminders).toBe(true)
})

describe('migration depuis la v1', () => {
  it('reprend les trois booléens en canaux', () => {
    kvStorage.setString(
      constants.NOTIF_PREFS_LEGACY,
      JSON.stringify({ master: false, reminders: false, progression: true }),
    )
    const prefs = getNotifPrefs()
    expect(prefs.master).toBe(false)
    expect(prefs.channels.reminders).toBe(false)
    expect(prefs.channels.progression).toBe(true)
  })

  it('n’hérite JAMAIS d’un consentement promotionnel', () => {
    // Personne n'a consenti à du promotionnel en cochant « rappels ».
    kvStorage.setString(
      constants.NOTIF_PREFS_LEGACY,
      JSON.stringify({ master: true, reminders: true, progression: true }),
    )
    expect(getNotifPrefs().channels.offers).toBe(false)
  })

  it('efface l’ancienne clé pour qu’aucun code ne puisse la relire', () => {
    kvStorage.setString(
      constants.NOTIF_PREFS_LEGACY,
      JSON.stringify({ master: true }),
    )
    getNotifPrefs()
    expect(kvStorage.getString(constants.NOTIF_PREFS_LEGACY)).toBeNull()
  })
})

it('persiste un changement de canal', () => {
  setChannel('offers', true)
  expect(getNotifPrefs().channels.offers).toBe(true)
})

describe('fenêtre de silence', () => {
  it('applique 22h–8h quand rien n’a été choisi', () => {
    expect(effectiveQuietHours(getNotifPrefs())).toEqual(DEFAULT_QUIET_HOURS)
  })

  it('REMPLACE le défaut plutôt que de s’y ajouter', () => {
    setNotifPrefs({
      ...getNotifPrefs(),
      quietHours: { startMinutes: 23 * 60, endMinutes: 7 * 60 },
    })
    const quiet = effectiveQuietHours(getNotifPrefs())
    const at2230 = new Date(2026, 6, 13, 22, 30).getTime()
    // Si la fenêtre par défaut s'ajoutait, choisir 23h–7h ne servirait à rien.
    expect(isWithinQuietHours(at2230, quiet)).toBe(false)
  })

  it('décale vers la sortie de fenêtre, en traversant minuit', () => {
    const at2330 = new Date(2026, 6, 13, 23, 30).getTime()
    const shifted = new Date(shiftOutOfQuietHours(at2330, DEFAULT_QUIET_HOURS))
    expect(shifted.getHours()).toBe(8)
    expect(shifted.getDate()).toBe(14)
  })

  it('décale un tir du petit matin au même jour', () => {
    const at0300 = new Date(2026, 6, 13, 3, 0).getTime()
    const shifted = new Date(shiftOutOfQuietHours(at0300, DEFAULT_QUIET_HOURS))
    expect(shifted.getHours()).toBe(8)
    expect(shifted.getDate()).toBe(13)
  })

  it('laisse intact ce qui tombe déjà en dehors', () => {
    const at1200 = new Date(2026, 6, 13, 12, 0).getTime()
    expect(shiftOutOfQuietHours(at1200, DEFAULT_QUIET_HOURS)).toBe(at1200)
  })
})
