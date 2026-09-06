/**
 * Lightweight nav-state persistence for Expo Router (MMKV via
 * `navigationStorage`): remembers only the last visited path and returns to
 * it once at cold start. Trades full stack restoration (e.g. a reopened
 * modal) for simplicity — resuming on the right tab covers the main case.
 */

import type { Href } from 'expo-router'
import { router, usePathname } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Linking } from 'react-native'
import { constants } from '@/config/constants'
import { navigationStorage } from '@/shared/services/storage/mmkv'

const KEY = constants.NAVIGATION_STATE_V1
const RESTORABLE_PATHS = new Set(['/home', '/blocks', '/activity'])

function isRestorablePath(path: string): boolean {
  return RESTORABLE_PATHS.has(path)
}

function loadLastPath(): string | undefined {
  const path = navigationStorage.getString(KEY) || undefined
  return path && isRestorablePath(path) ? path : undefined
}

function persistLastPath(path: string) {
  if (!isRestorablePath(path)) return
  navigationStorage.setString(KEY, path)
}

export function clearNavigationPersistence() {
  navigationStorage.delete(KEY)
}

/**
 * Une ENTRÉE EXTERNE revendique la navigation initiale.
 *
 * Le mur système ouvre Relock sans deep link : `Linking.getInitialURL()`
 * renvoie `null`, et la restauration du dernier onglet partait donc
 * tranquillement écraser la destination demandée par le mur. Comme la demande
 * est consommée de façon DESTRUCTIVE côté natif, elle était perdue pour de
 * bon : l'utilisateur tapait « Ouvrir Relock » et atterrissait sur l'Accueil,
 * sans rituel de déblocage et sans moyen de recommencer.
 *
 * On ne peut pas régler ça par un simple drapeau : les deux sondes sont
 * asynchrones et la course changerait au gré des latences. La restauration
 * ATTEND donc la réponse de l'entrée externe avant de décider.
 */
let externalEntry: Promise<boolean> | null = null

/**
 * À appeler SYNCHRONEMENT au montage, avec la promesse qui dira si une entrée
 * externe pilote bien la navigation (`true` = ne restaure rien).
 */
export function claimExternalEntry(probe: Promise<boolean>) {
  externalEntry = probe
}

/** Visible pour les tests. */
export function _resetExternalEntryForTests() {
  externalEntry = null
}

/** Flips once `useRestoreLastPath` has read (and possibly applied) the stored path. */
let restoreDecided = false
const restoreListeners = new Set<() => void>()

function markRestoreDecided() {
  if (restoreDecided) return
  restoreDecided = true
  for (const listener of restoreListeners) listener()
}

/** Saves the active path on every navigation, once restoration has had its chance to read it. */
export function usePersistLastPath() {
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    if (!restoreDecided) return
    persistLastPath(pathname)
  }, [pathname])

  // Covers the case where restoration settles without the pathname ever
  // changing (no deep link, no stored path to replace to) — the effect
  // above would then never re-run, so persistence needs to be nudged here.
  useEffect(() => {
    if (restoreDecided) return
    const onReady = () => persistLastPath(pathnameRef.current)
    restoreListeners.add(onReady)
    return () => {
      restoreListeners.delete(onReady)
    }
  }, [])
}

/**
 * Restores the last visited path once at cold start — skipped if a cold-start
 * deep link is already driving the initial navigation, or while `enabled` is
 * false (e.g. onboarding/auth not yet complete).
 */
export function useRestoreLastPath(enabled: boolean) {
  const didRestore = useRef(false)

  useEffect(() => {
    if (!enabled || didRestore.current) return
    didRestore.current = true

    Promise.all([
      Linking.getInitialURL().catch(() => null),
      // `false` quand personne n'a revendiqué : la restauration reprend son
      // comportement d'origine.
      externalEntry ?? Promise.resolve(false),
    ])
      .then(([url, claimedByExternalEntry]) => {
        if (url || claimedByExternalEntry) return
        const lastPath = loadLastPath()
        if (lastPath) router.replace(lastPath as Href)
      })
      .finally(() => {
        markRestoreDecided()
      })
  }, [enabled])
}
