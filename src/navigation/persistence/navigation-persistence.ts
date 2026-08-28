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

function loadLastPath(): string | undefined {
  return navigationStorage.getString(KEY) || undefined
}

function persistLastPath(path: string) {
  navigationStorage.setString(KEY, path)
}

export function clearNavigationPersistence() {
  navigationStorage.delete(KEY)
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

    Linking.getInitialURL()
      .then(url => {
        if (url) return
        const lastPath = loadLastPath()
        if (lastPath) router.replace(lastPath as Href)
      })
      .finally(() => {
        markRestoreDecided()
      })
  }, [enabled])
}
