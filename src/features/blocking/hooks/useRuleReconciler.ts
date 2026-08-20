import { useEffect, useRef } from 'react'
import { armRule } from '@/features/blocking/services/arm'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'

let reconciledThisLaunch = false

/** Visible pour les tests uniquement. */
export function _resetReconcilerForTests() {
  reconciledThisLaunch = false
}

/**
 * Ré-arme au lancement la surveillance native des règles PERSISTANTES actives
 * (plage horaire, limite/jour).
 *
 * iOS peut perdre les activités DeviceActivity (réinstallation, mise à jour,
 * reset système) alors que la règle reste « active » côté cloud : sans ce
 * ré-armement, la règle a l'air active mais ne bloque plus jamais rien.
 *
 * - Les « Bloquer maintenant » (timed) ne sont PAS ré-armés : les relancer
 *   repartirait pour une durée complète.
 * - Une limite/jour DÉJÀ ARMÉE côté iOS n'est pas touchée : chaque
 *   stop+start recrée ses seuils, et `includesPastActivity` (censé garder le
 *   compte depuis minuit) est le point le moins fiable de DeviceActivity.
 *   Zéro churn = zéro occasion pour iOS de perdre le compteur. On n'arme que
 *   ce qui manque réellement (réinstallation, reset système).
 * - Ré-armer une plage horaire est idempotent (ré-application immédiate si on
 *   est dans la fenêtre, purge du blocage fantôme sinon).
 */
export function useRuleReconciler(rules: BlockRuleView[], ready: boolean) {
  const done = useRef(false)

  useEffect(() => {
    if (!ready || done.current || reconciledThisLaunch) return
    if (!ScreenTime.isAvailable) return
    done.current = true
    reconciledThisLaunch = true

    const rearm = async () => {
      const armed = new Set(
        await ScreenTime.armedActivities().catch(() => [] as string[]),
      )
      for (const rule of rules) {
        if (!rule.isActive) continue
        if (rule.type !== 'schedule' && rule.type !== 'daily_limit') continue
        if (rule.type === 'daily_limit' && armed.has(`limit.${rule.id}`))
          continue
        try {
          await armRule(rule)
        } catch {
          // Autorisation absente / sélection perdue : l'UI le signale déjà
          // (bannière Temps d'écran) — on ne casse pas le lancement.
        }
      }
    }
    rearm().catch(() => undefined)
  }, [rules, ready])
}
