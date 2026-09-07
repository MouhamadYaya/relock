import { router } from 'expo-router'
import {
  AppState,
  DeviceEventEmitter,
  DevSettings,
  Linking,
  NativeModules,
} from 'react-native'
import { StatsService } from '@/features/blocking/services/stats/stats.service'
import {
  applyEntitlement,
  completeSetup,
  resetOnboarding,
} from '@/session/bootstrap'
import { ScreenTime } from '@/shared/native/screen-time'
import { genUUID } from '@/shared/utils/uuid'

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
      const payload = JSON.stringify(d, null, 2)
      console.log(`${TAG} diag`, payload)
      await report('diag', payload)
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
    case 'rules': {
      // Vue d'ensemble VÉRIFIABLE des trois mécaniques : ce que la base dit,
      // ce que le moteur JS en déduit, et ce qu'iOS a réellement armé. Une
      // règle « active » dont l'activité manque côté système ne bloquera
      // jamais rien — c'est précisément ce que cette confrontation révèle.
      const { BlockRulesService } = await import(
        '@/features/blocking/services/block-rules/block-rules.service'
      )
      const { buildSessions } = await import('@/features/blocking/session')
      const { nativeKindOf } = await import('@/shared/native/screen-time')
      const rules = await BlockRulesService.list()
      const [armed, steps] = await Promise.all([
        ScreenTime.armedActivities().catch(() => [] as string[]),
        ScreenTime.limitSteps().catch(() => ({}) as Record<string, number>),
      ])
      const sessions = buildSessions(rules, new Date(), steps)
      const prefix = { timed: 'timed', schedule: 'sched', limit: 'limit' }
      const payload = JSON.stringify(
        {
          armedActivities: armed,
          limitSteps: steps,
          rules: rules.map(rule => {
            const kind = nativeKindOf(rule.type)
            const expected = `${prefix[kind]}.${rule.id}`
            const session = sessions.find(s => s.rule.id === rule.id)
            return {
              id: rule.id,
              type: rule.type,
              isActive: rule.isActive,
              config: rule.config,
              count: rule.count,
              createdAt: rule.createdAt,
              state: session?.state ?? 'auto-supprimée',
              indicator: session?.indicator,
              expectedActivity: expected,
              // Un blocage court n'arme que son réveil « end.<id> ».
              armed:
                armed.includes(expected) || armed.includes(`end.${rule.id}`),
            }
          }),
        },
        null,
        2,
      )
      console.log(`${TAG} rules`, payload)
      await report('rules', payload)
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
    case 'pick': {
      // Ouvre le sélecteur système d'apps. C'est le SEUL moyen d'obtenir des
      // jetons Family Controls : Apple ne permet ni de les fabriquer ni de les
      // énumérer. Un test d'interface peut ensuite y cocher une app, ce qui
      // rend la vérification du mur reproductible.
      const res = await ScreenTime.presentPicker()
      const payload = JSON.stringify(res)
      console.log(`${TAG} pick`, payload)
      await report('pick', payload)
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
      // Même chemin que le bouton « restart · dev » de l'Accueil : efface le
      // drapeau, bascule le store, puis remplace explicitement vers
      // `/onboarding` (voir `resetOnboarding()` pour le pourquoi du
      // `replace`).
      resetOnboarding()
      console.log(`${TAG} onboarding réinitialisé`)
      return
    case 'onboarding-complete':
      // Symétrique de `onboarding-reset` : `completeSetup()` fait déjà le
      // flip + le `replace` explicite (voir son commentaire pour le pourquoi
      // du `replace`).
      completeSetup()
      console.log(`${TAG} onboarding marqué terminé`)
      return
    // La porte dure ne se teste pas sans pouvoir la refermer : `onboarding-reset`
    // ne touche PAS à l'abonnement (c'est un achat réel). Ces deux commandes
    // simulent l'abonné et l'expiré, replace explicite compris.
    case 'entitlement-lock':
      applyEntitlement(false)
      console.log(`${TAG} abonnement retiré (paywall)`)
      return
    case 'entitlement-unlock':
      applyEntitlement(true)
      console.log(`${TAG} abonnement accordé`)
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
      // `mkrule/<block_now|schedule|daily_limit>/<param>` : crée une VRAIE
      // règle de test, avec la sélection d'apps d'une règle existante
      // (`seedSelection` → `bindSelection`, seul chemin permis par Apple pour
      // recopier des jetons opaques). Elle est nommée « [TEST] … » et
      // `rmtest` la supprime — aucune règle de l'utilisateur n'est touchée.
      const mk = cmd.match(/^mkrule\/(block_now|schedule|daily_limit)\/(\d+)$/)
      if (mk) {
        const { BlockRulesService } = await import(
          '@/features/blocking/services/block-rules/block-rules.service'
        )
        const kind = mk[1]
        const value = Number(mk[2])
        const existing = await BlockRulesService.list()
        const donor = existing.find(r => (r.count ?? 0) > 0)
        const id = genUUID()
        // Avec une règle existante, on recopie SA sélection (seed → bind).
        // Sans aucune règle — cas normal après l'expiration d'un blocage
        // minuté — on repart du brouillon global, c'est-à-dire du dernier
        // choix fait dans le sélecteur Apple : le seul jeu de jetons encore
        // disponible sans rouvrir le sélecteur.
        if (donor) await ScreenTime.seedSelection(donor.id)
        await ScreenTime.bindSelection(id)
        const seeded = (await ScreenTime.selectionInfo(id)).total
        const config: Record<string, unknown> =
          kind === 'schedule'
            ? {
                name: `[TEST] plage ${value}h`,
                start_hour: value,
                start_minute: 0,
                end_hour: (value + 2) % 24,
                end_minute: 0,
                days: [1, 2, 3, 4, 5],
              }
            : kind === 'daily_limit'
              ? { name: `[TEST] limite ${value}min`, limit_min: value }
              : { name: `[TEST] minuté ${value}min`, duration_min: value }
        const type =
          kind === 'schedule'
            ? 'schedule'
            : kind === 'daily_limit'
              ? 'daily_limit'
              : 'progressive_delay'
        if (kind === 'schedule') {
          await ScreenTime.startSchedule(
            id,
            value,
            0,
            (value + 2) % 24,
            0,
            [1, 2, 3, 4, 5],
          )
        } else if (kind === 'daily_limit') {
          await ScreenTime.startDailyLimit(id, value)
        } else {
          await ScreenTime.startTimedBlock(id, value, false)
        }
        await BlockRulesService.create({
          id,
          type,
          appIds: [],
          count: seeded,
          config,
        })
        const armed = await ScreenTime.armedActivities().catch(() => [])
        const diag = await ScreenTime.getDiagnostics().catch(() => null)
        await report(
          'mkrule',
          JSON.stringify({ id, type, config, seeded, armed, diag }, null, 2),
        )
        return
      }
      // `pause/<ruleId>/<secondes>` puis `resume/<ruleId>` : cycle complet de
      // suspension. On renvoie `ruleDays` AVANT et APRÈS — c'est la preuve
      // qu'une plage « lun→ven » ne devient pas 7 j/7 après une pause.
      const pm = cmd.match(/^pause\/([0-9a-fA-F-]+)\/(\d+)$/)
      if (pm) {
        const until = Math.floor(Date.now() / 1000) + Number(pm[2])
        const before = await ScreenTime.getDiagnostics().catch(() => null)
        await ScreenTime.suspendRule(pm[1], Number(pm[2]) > 0 ? until : 0)
        const after = await ScreenTime.getDiagnostics().catch(() => null)
        await report(
          'pause',
          JSON.stringify(
            {
              ruleId: pm[1],
              ruleDaysAvant: before?.ruleDays,
              ruleDaysApres: after?.ruleDays,
              suspendues: after?.suspendedRules,
              shieldAvant: before?.shieldApplications,
              shieldApres: after?.shieldApplications,
            },
            null,
            2,
          ),
        )
        return
      }
      const rm = cmd.match(/^resume\/([0-9a-fA-F-]+)$/)
      if (rm) {
        const { BlockRulesService } = await import(
          '@/features/blocking/services/block-rules/block-rules.service'
        )
        const { armRule } = await import('@/features/blocking/services/arm')
        const before = await ScreenTime.getDiagnostics().catch(() => null)
        const rule = (await BlockRulesService.list()).find(r => r.id === rm[1])
        if (rule) await armRule(rule).catch(() => {})
        await ScreenTime.resumeRule(rm[1])
        const after = await ScreenTime.getDiagnostics().catch(() => null)
        await report(
          'resume',
          JSON.stringify(
            {
              ruleId: rm[1],
              ruleDaysAvant: before?.ruleDays,
              ruleDaysApres: after?.ruleDays,
              suspendues: after?.suspendedRules,
              shieldAvant: before?.shieldApplications,
              shieldApres: after?.shieldApplications,
            },
            null,
            2,
          ),
        )
        return
      }
      // `rmtest` : supprime toutes les règles « [TEST] … » (DB + natif).
      if (cmd === 'rmtest') {
        const { BlockRulesService } = await import(
          '@/features/blocking/services/block-rules/block-rules.service'
        )
        const { nativeKindOf } = await import('@/shared/native/screen-time')
        const rules = await BlockRulesService.list()
        const targets = rules.filter(r =>
          String(r.config?.name ?? '').startsWith('[TEST]'),
        )
        for (const rule of targets) {
          await BlockRulesService.remove(rule.id)
          await ScreenTime.clearRuleData(
            rule.id,
            nativeKindOf(rule.type),
          ).catch(() => {})
        }
        const diag = await ScreenTime.getDiagnostics().catch(() => null)
        await report(
          'rmtest',
          JSON.stringify({ supprimées: targets.map(r => r.id), diag }, null, 2),
        )
        return
      }
      // `limit/<on|off>/<ruleId>` : rejoue (ou annule) un quota du jour
      // atteint. Sert à vérifier que le mur tombe EN PLEINE session, ce qu'on
      // ne peut pas provoquer autrement (iOS seul décide des seuils).
      const lm = cmd.match(/^limit\/(on|off)\/([0-9a-fA-F-]+)$/)
      if (lm) {
        const before = await ScreenTime.getDiagnostics().catch(() => null)
        const res = await ScreenTime.simulateLimitReached(lm[2], lm[1] === 'on')
        const after = await ScreenTime.getDiagnostics().catch(() => null)
        const payload = JSON.stringify(
          {
            ruleId: lm[2],
            reached: lm[1] === 'on',
            result: res,
            shieldBefore: before?.shieldApplications ?? null,
            shieldAfter: after?.shieldApplications ?? null,
            activeWindowsAfter: after?.activeWindows ?? null,
            limitProgressAfter: after?.limitProgress ?? null,
          },
          null,
          2,
        )
        console.log(`${TAG} limit`, payload)
        await report('limit', payload)
        return
      }
      // `onboarding/<step id>` : saute directement à une étape narrative
      // (ex. `onboarding/auth`) sans rejouer tout le parcours à chaque reload.
      const om = cmd.match(/^onboarding\/([a-zA-Z]+)$/)
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
let polling = false

/**
 * Interrogation du serveur de commandes, à cadence ADAPTATIVE.
 *
 * ⚠️ La version précédente arrêtait le timer après 8 échecs — définitivement.
 * Sur un iPhone, huit échecs arrivent pour des raisons parfaitement banales :
 * l'app passe en arrière-plan, le Wi-Fi se rétablit, l'écran se verrouille. Le
 * pont devenait alors muet pour le RESTE de la vie du process, sans rien dire :
 * on croyait à une panne de l'app alors que seul le pilote était mort.
 *
 * On ne s'arrête donc plus jamais : après quelques échecs on ralentit à 10 s
 * (aucun coût quand il n'y a pas de serveur en face), et le premier succès
 * ramène la cadence nerveuse. Un retour au premier plan la ramène aussi tout
 * de suite — c'est exactement le moment où l'on relance des commandes.
 */
function pollCommands(): void {
  if (polling) return
  polling = true
  const CMD_URL = commandsUrl()
  const FAST_MS = 1500
  const SLOW_MS = 10_000
  const MISSES_BEFORE_SLOWDOWN = 8
  let misses = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const schedule = (delay: number) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(tick, delay)
  }

  const tick = async () => {
    let delay = misses >= MISSES_BEFORE_SLOWDOWN ? SLOW_MS : FAST_MS
    try {
      const res = await fetch(`${CMD_URL}?t=${Date.now()}`)
      if (res.ok) {
        misses = 0
        delay = FAST_MS
        const body = (await res.json()) as { id?: number; cmd?: string }
        if (typeof body.id === 'number' && typeof body.cmd === 'string') {
          // Premier contact du LANCEMENT : la commande déjà présente est du
          // passé — on la prend comme référence SANS l'exécuter. Sinon chaque
          // démarrage rejouait le dernier ordre (ex. « activity ») et
          // court-circuitait l'écran initial, onboarding compris.
          if (!baselined) {
            baselined = true
            lastCommandId = body.id
            console.log(`${TAG} référence #${body.id} (ignorée)`)
          } else if (body.id > lastCommandId) {
            lastCommandId = body.id
            console.log(`${TAG} exécute #${body.id}: ${body.cmd}`)
            await run(body.cmd).catch(e =>
              console.log(`${TAG} ${body.cmd} ERREUR`, String(e)),
            )
          }
        }
      }
    } catch {
      misses += 1
      if (misses === MISSES_BEFORE_SLOWDOWN) {
        console.log(
          `${TAG} serveur injoignable — cadence réduite à ${SLOW_MS}ms`,
        )
      }
      delay = misses >= MISSES_BEFORE_SLOWDOWN ? SLOW_MS : FAST_MS
    }
    schedule(delay)
  }

  // Le retour au premier plan est le moment où l'on attend une commande :
  // on reprend la cadence rapide sans attendre la fin d'un cycle lent.
  AppState.addEventListener('change', state => {
    if (state !== 'active') return
    misses = 0
    schedule(0)
  })

  schedule(0)
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
