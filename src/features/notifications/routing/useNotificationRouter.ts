/**
 * Consommation des taps de notification.
 *
 * Pas d'émetteur d'événements natif ici, et c'est délibéré : un tap démarre
 * souvent l'app À FROID, bien avant que React Native ne soit prêt à recevoir
 * quoi que ce soit. Le délégué natif écrit la réponse sur disque, on la lit
 * dès qu'on est vivant — même schéma que la demande d'ouverture du mur
 * (`usePendingShieldRequest`), pour exactement la même raison.
 *
 * La lecture est DESTRUCTIVE côté natif : une réponse traitée deux fois
 * naviguerait deux fois.
 */
import { router } from 'expo-router'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useBlockRulesQuery } from '@/features/blocking/hooks/useBlockRulesQuery'
import { noteInteraction } from '@/features/notifications/engine/fatigue'
import { logNotifEvent } from '@/features/notifications/engine/log'
import { readSignals } from '@/features/notifications/engine/signals'
import {
  readEngineState,
  writeEngineState,
} from '@/features/notifications/engine/state'
import {
  parsePayload,
  resolveRoute,
} from '@/features/notifications/routing/deep-link'
import type { RouteGuardContext } from '@/features/notifications/types'
import { Notif } from '@/shared/native/notifications'
import { ScreenTime } from '@/shared/native/screen-time'
import { useAppGateStore } from '@/shared/stores/app-gate.store'

/**
 * Consomme les taps en attente et navigue.
 *
 * `enabled` : tant que la porte de l'app n'est pas franchie, naviguer vers un
 * onglet ferait entrer l'utilisateur dans un écran qu'il n'a pas le droit de
 * voir — et `Stack.Protected` le renverrait aussitôt. On attend.
 */
export function useNotificationRouter(enabled: boolean): void {
  const entitled = useAppGateStore(state => state.entitled)
  const { rules } = useBlockRulesQuery()

  useEffect(() => {
    if (!enabled || !Notif.hasRoutingSupport) return
    let cancelled = false

    const drain = async (): Promise<void> => {
      const responses = await Notif.consumeResponses().catch(() => [])
      if (cancelled || responses.length === 0) return

      const screenTimeAuthorized = await ScreenTime.authorizationStatus()
        .then(status => status === 'approved')
        .catch(() => false)

      const guardContext: RouteGuardContext = {
        entitled,
        ruleIds: rules.map(rule => rule.id),
        screenTimeAuthorized,
        offerActive: readSignals().offerAvailable,
      }

      // Un seul tap peut être honoré : deux navigations concurrentes se
      // gagneraient l'une l'autre au hasard. On prend le plus récent.
      const latest = responses[responses.length - 1]
      const payload = parsePayload(latest.payload)
      if (!payload) return

      const destination = resolveRoute(payload, guardContext)

      // Le tap nourrit le score de fatigue de la famille, dans le sens
      // positif. On mémorise aussi QUELLE famille a été touchée : si un
      // blocage est armé dans l'heure qui suit, c'est elle qu'il faut créditer
      // — une action vaut plus qu'une curiosité.
      const respondedAt = Date.now()
      const state = noteInteraction(readEngineState(), payload.f, 'tap')
      writeEngineState(
        { ...state, lastTap: { family: payload.f, at: respondedAt } },
        respondedAt,
      )

      logNotifEvent({
        t: Date.now(),
        k: 'responded',
        n: payload.n,
        f: payload.f,
        va: payload.va,
        at: latest.respondedAt * 1000,
      })

      router.navigate({
        pathname: destination.pathname as never,
        params: destination.params as never,
      })

      logNotifEvent({
        t: Date.now(),
        k: 'route_opened',
        n: payload.n,
        f: payload.f,
        reason: destination.redirected ? 'condition_changed' : undefined,
      })
    }

    void drain()
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') void drain()
    })
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [enabled, entitled, rules])
}
