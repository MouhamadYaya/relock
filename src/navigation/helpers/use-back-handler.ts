// src/navigation/helpers/use-back-handler.ts
import { router, usePathname } from 'expo-router'
import { useEffect, useRef } from 'react'
import { BackHandler, Platform } from 'react-native'

/**
 * Android back button handler.
 * canExit(pathname) → true if the app can exit from that route.
 */
export function useBackButtonHandler(canExit: (pathname: string) => boolean) {
  const pathname = usePathname()

  // keep latest values without re-subscribing
  const canExitRef = useRef(canExit)
  useEffect(() => {
    canExitRef.current = canExit
  }, [canExit])
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    // iOS: do nothing, but hooks are still called (no early return)
    if (Platform.OS !== 'android') return

    const onBackPress = () => {
      if (canExitRef.current(pathnameRef.current)) {
        BackHandler.exitApp()
        return true
      }

      if (router.canGoBack()) {
        router.back()
        return true
      }

      return false
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    )

    return () => {
      subscription.remove()
    }
  }, [])
}
