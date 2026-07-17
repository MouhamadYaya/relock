import { CommonActions } from '@react-navigation/native'
import { DeviceEventEmitter, Linking, NativeModules } from 'react-native'
import { StatsService } from '@/features/blocking/services/stats/stats.service'
import {
  navigate,
  navigationRef,
} from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { ScreenTime } from '@/shared/native/screen-time'

/** Événement interne (dev) : force période/décalage de l'écran Activité. */
export const DEV_EVENT_ACTIVITY_PERIOD = 'relock-dev-activity-period'

/**
 * DEV uniquement : pont de pilotage par deep link, pour tester l'app SANS
 * contrôle de l'écran (simulateur piloté en ligne de commande) :
 *
 *   xcrun simctl openurl booted "relock://dev/diag"
 *
 * Commandes : `diag` (bilan natif), `pull` (journal brut), `sync` (synchro
 * stats + ligne du jour), `home` / `activity` / `settings` (navigation).
 * Résultats dans la console Metro, préfixés `[DEV-BRIDGE]`.
 * Inactif en release (jamais enregistré).
 */
const TAG = '[DEV-BRIDGE]'

async function run(cmd: string): Promise<void> {
  switch (cmd) {
    case 'diag': {
      const d = await ScreenTime.getDiagnostics()
      console.log(`${TAG} diag`, JSON.stringify(d, null, 2))
      return
    }
    case 'pull': {
      const events = await ScreenTime.pullEvents()
      console.log(`${TAG} pull count=${events.length}`, JSON.stringify(events))
      return
    }
    case 'sync': {
      await StatsService.syncFromDevice()
      const today = await StatsService.today()
      console.log(`${TAG} sync → today=`, JSON.stringify(today))
      return
    }
    case 'auth': {
      // Sans autorisation Temps d'écran, iOS ne lance PAS l'extension de
      // rapport : toutes les vues restent vides. Permet de la (re)demander
      // sans avoir à toucher l'écran.
      const status = await ScreenTime.requestAuthorization()
      console.log(`${TAG} authorization → ${status}`)
      return
    }
    case 'home':
      navigationRef.dispatch(
        CommonActions.navigate(ROUTES.ROOT_APP, { screen: ROUTES.TAB_HOME }),
      )
      console.log(`${TAG} navigate home`)
      return
    case 'activity':
      navigationRef.dispatch(
        CommonActions.navigate(ROUTES.ROOT_APP, {
          screen: ROUTES.TAB_ACTIVITY,
        }),
      )
      console.log(`${TAG} navigate activity`)
      return
    case 'settings':
      navigate(ROUTES.SETTINGS)
      console.log(`${TAG} navigate settings`)
      return
    default: {
      // `activity-period/<période 0|1|2>/<décalage>` : pilote les filtres
      // de l'écran Activité (validation visuelle Jour/Semaine/Mois).
      const m = cmd.match(/^activity-period\/(\d)\/(\d+)$/)
      if (m) {
        DeviceEventEmitter.emit(DEV_EVENT_ACTIVITY_PERIOD, {
          period: Number(m[1]),
          offset: Number(m[2]),
        })
        console.log(`${TAG} activity period=${m[1]} offset=${m[2]}`)
        return
      }
      console.log(`${TAG} commande inconnue: ${cmd}`)
    }
  }
}

function handleUrl(url: string | null) {
  if (!url || !url.startsWith('relock://dev/')) return
  const cmd = url.slice('relock://dev/'.length).replace(/\/+$/, '')
  run(cmd).catch(e => console.log(`${TAG} ${cmd} ERREUR`, String(e)))
}

/**
 * Canal principal sur simulateur : POLLING HTTP localhost (le simulateur
 * partage le réseau du Mac). `simctl openurl` déclenche un dialogue système
 * « Ouvrir dans Relock ? » qui exige un tap — inutilisable en pilotage
 * scripté. On sonde donc un petit serveur de fichiers local :
 *
 *   python3 -m http.server 8123   (dans un dossier contenant
 *   relock-dev-commands.json : {"id": 1, "cmd": "diag"})
 *
 * Un `id` strictement croissant évite de rejouer une commande. Serveur
 * absent = silence total (aucun coût hors dev).
 */
/**
 * Hôte du serveur de commandes : la machine de dev.
 *
 * `localhost` ne vaut que sur simulateur — sur un iPhone il désigne le
 * TÉLÉPHONE. On réutilise donc l'hôte du bundle servi par Metro
 * (`scriptURL` = http://192.168.x.x:8081/index.bundle…), qui est par
 * construction l'adresse du Mac vue par l'appareil.
 */
function commandsUrl(): string {
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined
  const host = scriptURL?.match(/^https?:\/\/([^/:]+)/)?.[1] ?? 'localhost'
  return `http://${host}:8123/relock-dev-commands.json`
}

let lastCommandId = 0

function pollCommands(): void {
  const CMD_URL = commandsUrl()
  // Sans serveur (dev sur iPhone, session normale), on abandonne vite :
  // pas de requête réseau ratée toutes les 1,5 s à l'infini.
  let misses = 0
  const timer = setInterval(async () => {
    try {
      const res = await fetch(`${CMD_URL}?t=${Date.now()}`)
      if (!res.ok) return
      misses = 0
      const body = (await res.json()) as { id?: number; cmd?: string }
      if (
        typeof body.id !== 'number' ||
        body.id <= lastCommandId ||
        typeof body.cmd !== 'string'
      ) {
        return
      }
      lastCommandId = body.id
      console.log(`${TAG} exécute #${body.id}: ${body.cmd}`)
      await run(body.cmd)
    } catch {
      misses += 1
      if (misses >= 8) clearInterval(timer)
    }
  }, 1500)
}

export function initDevTestBridge(): void {
  if (!__DEV__) return
  // Jest : pas de polling (timer ouvert = worker qui ne se termine pas).
  if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID != null) {
    return
  }
  Linking.addEventListener('url', ({ url }) => handleUrl(url))
  Linking.getInitialURL()
    .then(handleUrl)
    .catch(() => {})
  pollCommands()
  console.log(`${TAG} prêt (relock://dev/… + polling ${commandsUrl()})`)
}
