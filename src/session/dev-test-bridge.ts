import { router } from 'expo-router'
import {
  DeviceEventEmitter,
  DevSettings,
  Linking,
  NativeModules,
} from 'react-native'
import { constants } from '@/config/constants'
import { StatsService } from '@/features/blocking/services/stats/stats.service'
import { completeOnboarding } from '@/session/bootstrap'
import { ScreenTime } from '@/shared/native/screen-time'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { useAppGateStore } from '@/shared/stores/app-gate.store'

/** Événement interne (dev) : force le jour affiché par l'écran Activité. */
export const DEV_EVENT_ACTIVITY_DAY = 'relock-dev-activity-day'
/** Événement interne (dev) : saute l'onboarding directement à une étape. */
export const DEV_EVENT_ONBOARDING_JUMP = 'relock-dev-onboarding-jump'

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

/**
 * Hôte de la machine de dev, vu depuis l'appareil.
 *
 * ⚠️ En BRIDGELESS (New Architecture), `NativeModules.SourceCode` n'est pas
 * peuplé : on retombait sur `localhost`, qui sur un iPhone désigne le
 * TÉLÉPHONE — le pont était donc muet sur appareil physique (aucune commande
 * reçue, aucun résultat renvoyé). `getDevServer()` reste fiable dans les deux
 * runtimes ; `SourceCode` n'est plus qu'un repli.
 */
function devHost(): string {
  try {
    const getDevServer =
      require('react-native/Libraries/Core/Devtools/getDevServer').default
    const url = getDevServer?.()?.url as string | undefined
    const host = url?.match(/^https?:\/\/([^/:]+)/)?.[1]
    if (host) return host
  } catch {
    // Repli ci-dessous.
  }
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined
  return scriptURL?.match(/^https?:\/\/([^/:]+)/)?.[1] ?? 'localhost'
}

/**
 * Renvoie un résultat au Mac (port 8124). Les logs Metro ne sont pas toujours
 * lisibles depuis un pilotage scripté : ce canal l'est toujours.
 */
async function report(what: string, payload: string): Promise<void> {
  try {
    await fetch(`http://${devHost()}:8124/${what}`, {
      method: 'POST',
      body: payload,
    })
  } catch {
    // Pas de serveur en face : le log console suffit.
  }
}

async function run(cmd: string): Promise<void> {
  switch (cmd) {
    case 'diag': {
      const d = await ScreenTime.getDiagnostics()
      console.log(`${TAG} diag`, JSON.stringify(d, null, 2))
      return
    }
    case 'selinfo': {
      // Ce que le NATIF sait de chaque règle : combien d'apps / catégories /
      // domaines, et quels rangs sont en sursis. C'est la seule façon de
      // savoir si « une seule icône » vient des données ou du rendu.
      const { BlockRulesService } = await import(
        '@/features/blocking/services/block-rules/block-rules.service'
      )
      const rules = await BlockRulesService.list()
      const out: unknown[] = []
      for (const r of rules) {
        const info = await ScreenTime.selectionInfo(r.id).catch(e => String(e))
        const rep = await ScreenTime.reprievedApps(r.id).catch(() => ({}))
        out.push({
          id: r.id,
          type: r.type,
          isActive: r.isActive,
          dbCount: r.count,
          native: info,
          reprieved: rep,
        })
      }
      const payload = JSON.stringify(out, null, 2)
      console.log(`${TAG} selinfo`, payload)
      await report('selinfo', payload)
      return
    }
    case 'blocked': {
      // Union DÉDUPLIQUÉE des apps réellement sous bouclier : c'est
      // exactement ce que la rangée « Apps bloquées » dessine.
      const keys = await ScreenTime.blockedAppKeys()
      const payload = JSON.stringify(
        { count: keys.length, unique: new Set(keys).size, keys },
        null,
        2,
      )
      console.log(`${TAG} blocked`, payload)
      await report('blocked', payload)
      return
    }
    case 'unlock-test': {
      // Débloque la 1re app 5 min, puis relit : elle doit RESTER dans la
      // liste, marquée « ouverte ».
      const before = await ScreenTime.blockedAppKeys()
      if (before.length > 0) await ScreenTime.unblockAppKey(before[0], 5)
      const [after, reprieved] = await Promise.all([
        ScreenTime.blockedAppKeys(),
        ScreenTime.reprievedKeys(),
      ])
      const payload = JSON.stringify(
        {
          before: before.length,
          after: after.length,
          stillListed: before[0] ? after.includes(before[0]) : null,
          reprievedCount: Object.keys(reprieved).length,
        },
        null,
        2,
      )
      console.log(`${TAG} unlock-test`, payload)
      await report('unlock-test', payload)
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
      router.navigate('/(tabs)/home')
      console.log(`${TAG} navigate home`)
      return
    case 'activity':
      router.navigate('/(tabs)/activity')
      console.log(`${TAG} navigate activity`)
      return
    case 'settings':
      router.navigate('/settings')
      console.log(`${TAG} navigate settings`)
      return
    case 'onboarding-reset':
      // Efface le drapeau, bascule le store, PUIS remplace explicitement
      // vers `/onboarding`. Le simple flip du store (sans ce `replace`)
      // laisse `Stack.Protected` rediriger seul vers son ancre (`app/
      // index.tsx`, lui-même un `<Redirect>`) : ce rebond en deux temps —
      // pendant que l'écran (tabs) est encore actif — laisse le native
      // stack (react-native-screens) non composité : app entièrement noire
      // jusqu'à ce qu'une navigation ordinaire ultérieure force un nouveau
      // rendu. Reproduit et vérifié sur iOS 26 / Simulateur (2026-08-30).
      kvStorage.delete(constants.ONBOARDING_DONE)
      useAppGateStore.getState().resetOnboardingDone()
      router.replace('/onboarding')
      console.log(`${TAG} onboarding réinitialisé`)
      return
    case 'onboarding-complete':
      // Symétrique de `onboarding-reset` : `completeOnboarding()` fait déjà
      // le flip + le `replace` explicite (voir son commentaire pour le
      // pourquoi du `replace`).
      completeOnboarding()
      console.log(`${TAG} onboarding marqué terminé`)
      return
    case 'dev-session': {
      // Déconnecte le compte courant (souvent restauré depuis le Keychain,
      // même après une réinstallation) pour forcer `ensureDevSession()` à
      // reconnecter le compte dev (DEV_LOGIN_EMAIL) au prochain montage —
      // utile pour tester avec des données seedées sans le mot de passe du
      // vrai compte.
      const { supabase } = await import('@/shared/services/supabase/client')
      await supabase.auth.signOut()
      console.log(`${TAG} déconnecté, rechargement…`)
      DevSettings.reload()
      return
    }
    default: {
      // `activity-day/<décalage 0…6>` pilote le jour de l'écran Activité.
      const m = cmd.match(/^activity-day\/(\d)$/)
      if (m) {
        const offset = Number(m[1])
        if (offset > 6) return
        DeviceEventEmitter.emit(DEV_EVENT_ACTIVITY_DAY, { offset })
        console.log(`${TAG} activity day offset=${offset}`)
        return
      }
      // `onboarding/<step id>` : saute directement à une étape narrative
      // (ex. `onboarding/auth`) sans rejouer tout le parcours à chaque reload.
      const om = cmd.match(/^onboarding\/([a-z]+)$/)
      if (om) {
        DeviceEventEmitter.emit(DEV_EVENT_ONBOARDING_JUMP, { step: om[1] })
        console.log(`${TAG} onboarding jump=${om[1]}`)
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
  return `http://${devHost()}:8123/relock-dev-commands.json`
}

/**
 * Sonde de persistance (dev) : MMKV charge-t-il vraiment, ou l'app vit-elle
 * sur le repli mémoire (rien ne persiste) ? Résultat envoyé au Mac sur le
 * port 8124 — visible dans le journal d'un simple `python3 -m http.server`.
 */
function probeStorage(): void {
  let r: string
  try {
    const { createMMKV } = require('react-native-mmkv')
    const s = createMMKV({ id: 'mmkv-storage' })
    // Marqueur inter-lancements : 'seen' au 2e démarrage ⇔ la persistance
    // disque fonctionne vraiment (pas un magasin RAM qui ment).
    const persisted = s.getString('dev.probe.persist') ?? 'none'
    s.set('dev.probe.persist', 'seen')
    let base = '?'
    try {
      const { NitroModules } = require('react-native-nitro-modules')
      base = NitroModules.createHybridObject(
        'MMKVPlatformContext',
      ).getBaseDirectory()
    } catch (e2) {
      base = `ctx-fail:${String(e2)}`
    }
    r = `persist=${persisted} onboarding=${s.getString('onboarding.done.v3') ?? 'null'} base=${base}`
  } catch (e) {
    r = `FAIL ${String(e)}`
  }
  fetch(
    `http://${devHost()}:8124/storage-probe?r=${encodeURIComponent(r).slice(0, 800)}`,
  ).catch(() => {})
}

let lastCommandId = 0
let baselined = false

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
      if (typeof body.id !== 'number' || typeof body.cmd !== 'string') return
      // Premier contact du LANCEMENT : la commande déjà présente est du
      // passé — on la prend comme référence SANS l'exécuter. Sinon chaque
      // démarrage rejouait le dernier ordre (ex. « activity ») et
      // court-circuitait l'écran initial, onboarding compris.
      if (!baselined) {
        baselined = true
        lastCommandId = body.id
        console.log(`${TAG} référence #${body.id} (ignorée)`)
        return
      }
      if (body.id <= lastCommandId) return
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
  probeStorage()
  console.log(`${TAG} prêt (relock://dev/… + polling ${commandsUrl()})`)
}
