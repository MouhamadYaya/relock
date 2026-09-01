import { useCallback, useEffect, useRef, useState } from 'react'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'

export interface BlockedApp {
  /** Identité stable du jeton (cf. `ScreenTime.blockedAppKeys`). */
  key: string
  /** Sursis en cours : l'app est ouverte, mais toujours sous protection. */
  unlocked: boolean
  /** Fin du sursis (epoch en secondes), absente quand l'app est verrouillée. */
  reprievedUntil?: number
  /** Règles actives qui contiennent cette app opaque. */
  ruleIds: string[]
}

export interface RuleAppKeys {
  ruleId: string
  keys: string[]
}

/** Assemble l'autorité native globale avec l'appartenance de chaque règle. */
export function mergeBlockedApps(
  keys: string[],
  reprieved: Record<string, number>,
  rules: RuleAppKeys[],
): BlockedApp[] {
  return keys.map(key => {
    const reprievedUntil = reprieved[key]
    return {
      key,
      unlocked: reprievedUntil != null,
      reprievedUntil,
      ruleIds: rules
        .filter(rule => rule.keys.includes(key))
        .map(rule => rule.ruleId),
    }
  })
}

/**
 * Les apps couvertes par une protection en cours, DÉDUPLIQUÉES.
 *
 * ⚠️ Une app visée par trois règles reste UNE app. Et une app débloquée
 * temporairement RESTE dans la liste : elle passe simplement en « ouverte ».
 * La faire disparaître laissait croire qu'elle n'était plus protégée du tout,
 * alors que le sursis expire tout seul et que le blocage reprend.
 */
/**
 * Plancher du réveil d'échéance. Une échéance DÉJÀ passée que le natif
 * continue de rapporter relançait une lecture à 0 ms, qui reprogrammait une
 * lecture à 0 ms : le pont natif était interrogé en boucle serrée.
 */
const REPRIEVE_RETRY_MS = 1000

export function useBlockedApps(runningRules: BlockRuleView[]) {
  const [apps, setApps] = useState<BlockedApp[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const runningRulesRef = useRef(runningRules)
  const requestRef = useRef(0)
  runningRulesRef.current = runningRules

  // Signature stable : sans elle, un nouveau tableau à chaque rendu
  // relancerait la lecture native en boucle.
  const ruleIds = runningRules.map(rule => rule.id).join(',')

  const load = useCallback(async (_nativeRefreshTrigger?: string) => {
    const request = ++requestRef.current
    // `activeWindows` côté natif est l'autorité. On le relit même si le calcul
    // JS des sessions n'est pas encore stabilisé : sinon une vraie fenêtre déjà
    // ouverte pouvait rester invisible jusqu'au prochain rendu de l'écran.
    if (!ScreenTime.isAvailable) {
      if (request === requestRef.current) {
        setApps([])
        setIsLoading(false)
      }
      return
    }
    try {
      const rulesSnapshot = runningRulesRef.current
      const [keys, reprieved, ruleKeys] = await Promise.all([
        ScreenTime.blockedAppKeys(),
        ScreenTime.reprievedKeys().catch((): Record<string, number> => ({})),
        Promise.all(
          rulesSnapshot.map(async rule => ({
            ruleId: rule.id,
            keys: await ScreenTime.appKeys(rule.id).catch((): string[] => []),
          })),
        ),
      ])
      if (request !== requestRef.current) return
      setApps(mergeBlockedApps(keys, reprieved, ruleKeys))
    } catch {
      // Une lecture native transitoire ne doit pas effacer une rangée déjà
      // fiable. Au premier chargement, `apps` est déjà vide.
    } finally {
      if (request === requestRef.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // La valeur elle-même n'est pas transmise au natif : son changement est le
    // signal qu'une session JS vient de démarrer ou de finir et qu'il faut
    // relire l'autorité native `activeWindows`.
    setIsLoading(true)
    load(ruleIds)
  }, [load, ruleIds])

  // Le texte et le cadenas se resynchronisent à l'échéance, même si aucune
  // règle React n'a changé entre-temps. Après suspension de l'app, le timeout
  // reprend à son retour au premier passage de la boucle JS.
  useEffect(() => {
    const next = apps
      .map(app => app.reprievedUntil)
      .filter((until): until is number => until != null)
      .sort((a, b) => a - b)[0]
    if (next == null) return
    const delay = Math.max(REPRIEVE_RETRY_MS, next * 1000 - Date.now() + 100)
    const id = setTimeout(() => load('reprieve-expired'), delay)
    return () => clearTimeout(id)
  }, [apps, load])

  return { apps, isLoading, refresh: load }
}
