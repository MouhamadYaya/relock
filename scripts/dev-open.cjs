/**
 * Ouvre l'app Relock (dev-client) directement sur le serveur Metro, sans passer
 * par l'écran « Enter URL manually » du dev-launcher.
 *
 * Pourquoi c'est nécessaire : le dev-launcher relance tout seul le dernier bundle
 * ouvert, mais cette mémoire vit dans les données de l'app — une désinstallation
 * la vide. Et sur iPhone physique, `expo run:ios` se contente d'installer le
 * binaire (cf. launchApp.js : `if (!props.isSimulator) … return`), il ne passe
 * jamais l'URL du serveur.
 *
 * Mécanisme : le dev-launcher lit l'argument de lancement `--initialUrl <url>` au
 * démarrage et charge cette URL avant d'afficher son UI
 * (EXDevLauncherController.initialUrlFromProcessInfo). Sur Android on passe par le
 * deep link `relock://expo-development-client/?url=…`.
 *
 * L'URL est recalculée à CHAQUE lancement → un changement d'IP LAN (DHCP) ou une
 * réinstallation de l'app n'ont aucun impact.
 *
 * Usage :
 *   node scripts/dev-open.cjs                        # iPhone branché, sinon simulateur
 *   node scripts/dev-open.cjs --platform android
 *   node scripts/dev-open.cjs --host 192.168.1.42 --port 8081
 *   node scripts/dev-open.cjs --device "iPhone de Mhd"
 */
const { execFileSync } = require('node:child_process')
const http = require('node:http')
const os = require('node:os')

const BUNDLE_ID = 'com.yaya.relock'
const SCHEME = 'relock'

const run = (cmd, args) =>
  execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const tryRun = (cmd, args) => {
  try {
    return { ok: true, out: run(cmd, args) }
  } catch (error) {
    return {
      ok: false,
      out: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim(),
    }
  }
}

/** IP LAN de la machine — celle qu'`expo start --lan` affiche. */
function lanIp() {
  const ifaces = os.networkInterfaces()
  // en0 = Wi-Fi sur Mac, en1/en2 = Ethernet/Thunderbolt : on garde cet ordre de préférence.
  const rank = name => (name === 'en0' ? 0 : name.startsWith('en') ? 1 : 2)
  for (const name of Object.keys(ifaces).sort((a, b) => rank(a) - rank(b))) {
    for (const addr of ifaces[name] ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address
    }
  }
  return null
}

function resolveMetroUrl({ host, port } = {}) {
  const resolvedPort = port ?? process.env.RCT_METRO_PORT ?? '8081'
  const resolvedHost = host ?? process.env.EXPO_PACKAGER_HOSTNAME ?? lanIp()
  if (!resolvedHost) return null
  return `http://${resolvedHost}:${resolvedPort}`
}

/** Metro répond-il ? Évite d'ouvrir l'app sur une URL morte. */
function metroIsUp(metroUrl, timeoutMs = 1500) {
  return new Promise(resolve => {
    const req = http.get(`${metroUrl}/status`, { timeout: timeoutMs }, res => {
      let body = ''
      res.on('data', chunk => {
        body += chunk
      })
      res.on('end', () => resolve(body.includes('packager-status:running')))
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitForMetro(metroUrl, { timeoutMs = 120_000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await metroIsUp(metroUrl)) return true
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

function bootedSimulatorUdid() {
  const res = tryRun('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'])
  if (!res.ok) return null
  try {
    const devices = Object.values(JSON.parse(res.out).devices ?? {}).flat()
    return devices.find(d => d.state === 'Booted')?.udid ?? null
  } catch {
    return null
  }
}

function connectedIosDevice(wantedName) {
  const res = tryRun('xcrun', ['devicectl', 'list', 'devices'])
  if (!res.ok) return null
  for (const line of res.out.split('\n')) {
    if (!line.includes('connected')) continue
    const id = line.match(
      /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/i,
    )?.[0]
    if (!id) continue
    if (wantedName && !line.toLowerCase().includes(wantedName.toLowerCase()))
      continue
    return { id, name: line.split(/\s{2,}/)[0].trim() }
  }
  return null
}

function openIos(metroUrl, { device: wantedName } = {}) {
  const device = connectedIosDevice(wantedName)
  if (device) {
    const res = tryRun('xcrun', [
      'devicectl',
      'device',
      'process',
      'launch',
      '--device',
      device.id,
      '--terminate-existing',
      BUNDLE_ID,
      '--initialUrl',
      metroUrl,
    ])
    if (res.ok) {
      console.log(`[dev-open] ${device.name} → ${metroUrl}`)
      return true
    }
    console.warn(`[dev-open] Lancement sur ${device.name} échoué :\n${res.out}`)
  }

  const udid = bootedSimulatorUdid()
  if (!udid) {
    console.warn('[dev-open] Aucun iPhone branché ni simulateur démarré.')
    return false
  }
  const res = tryRun('xcrun', [
    'simctl',
    'launch',
    '--terminate-running-process',
    udid,
    BUNDLE_ID,
    '--initialUrl',
    metroUrl,
  ])
  if (!res.ok) {
    console.warn(`[dev-open] Lancement simulateur échoué :\n${res.out}`)
    return false
  }
  console.log(`[dev-open] Simulateur → ${metroUrl}`)
  return true
}

function openAndroid(metroUrl, { port }) {
  // `adb reverse` rend `localhost:<port>` valide depuis l'appareil : URL stable, IP LAN inutile.
  const reversed = tryRun('adb', ['reverse', `tcp:${port}`, `tcp:${port}`]).ok
  const target = reversed ? `http://localhost:${port}` : metroUrl
  const deepLink = `${SCHEME}://expo-development-client/?url=${encodeURIComponent(target)}`
  const res = tryRun('adb', [
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    deepLink,
  ])
  if (!res.ok) {
    console.warn(`[dev-open] Lancement Android échoué :\n${res.out}`)
    return false
  }
  console.log(`[dev-open] Android → ${target}`)
  return true
}

/**
 * @param {{platform?: 'ios'|'android', host?: string, port?: string, device?: string, waitMs?: number}} options
 */
async function openDevClient(options = {}) {
  const port = options.port ?? process.env.RCT_METRO_PORT ?? '8081'
  const metroUrl = resolveMetroUrl({ host: options.host, port })
  if (!metroUrl) {
    console.error(
      '[dev-open] Aucune IP LAN trouvée. Passe --host <ip> explicitement.',
    )
    return false
  }

  const up = options.waitMs
    ? await waitForMetro(metroUrl, { timeoutMs: options.waitMs })
    : await metroIsUp(metroUrl)
  if (!up) {
    console.warn(
      `[dev-open] Metro ne répond pas sur ${metroUrl} — lance \`npm start\`, puis \`npm run dev:open\`.`,
    )
    return false
  }

  const platform =
    options.platform ?? (process.platform === 'darwin' ? 'ios' : 'android')
  return platform === 'android'
    ? openAndroid(metroUrl, { port })
    : openIos(metroUrl, options)
}

module.exports = { openDevClient, resolveMetroUrl, metroIsUp, waitForMetro }

if (require.main === module) {
  const argv = process.argv.slice(2)
  const argOf = name => {
    const i = argv.indexOf(`--${name}`)
    return i !== -1 && argv[i + 1] ? argv[i + 1] : undefined
  }
  const waitArg = argOf('wait')
  openDevClient({
    platform: argOf('platform'),
    host: argOf('host'),
    port: argOf('port'),
    device: argOf('device'),
    waitMs: waitArg ? Number(waitArg) * 1000 : undefined,
  }).then(ok => {
    process.exitCode = ok ? 0 : 1
  })
}
