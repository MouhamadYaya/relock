/**
 * Build + install + connexion automatique au serveur Metro, en une commande.
 *
 * Séquence (l'ordre évite toute course) :
 *   1. `expo run:<platform> --no-bundler` → build + install, puis rend la main.
 *   2. `expo start --dev-client --lan --scheme relock` → Metro au premier plan.
 *   3. dès que Metro répond, on relance l'app avec l'URL du serveur (dev-open).
 *
 * `--no-bundler` est indispensable : sans lui, `expo run:ios` garde Metro au
 * premier plan et ne rend jamais la main, donc rien ne peut s'enchaîner après.
 *
 * Si un Metro tourne déjà sur le port (typiquement `npm start` dans un autre
 * terminal), on n'en démarre pas un second : on build, on connecte, et on sort.
 * Le build utilise alors un port libre, car `expo run` démarre malgré tout un
 * serveur headless éphémère qui entrerait en conflit avec celui déjà en place.
 *
 * Usage : node scripts/dev-run.cjs --platform ios [-- <args passés à expo run>]
 */
const { spawn } = require('node:child_process')
const net = require('node:net')
const {
  openDevClient,
  resolveMetroUrl,
  waitForMetro,
} = require('./dev-open.cjs')

const argv = process.argv.slice(2)
const argOf = name => {
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] ? argv[i + 1] : undefined
}
const passthrough = argv.includes('--')
  ? argv.slice(argv.indexOf('--') + 1)
  : []

const platform = argOf('platform') === 'android' ? 'android' : 'ios'
const port = argOf('port') ?? process.env.RCT_METRO_PORT ?? '8081'

const spawnStep = args =>
  spawn('npx', ['expo', ...args], { stdio: 'inherit', env: process.env })

const waitForExit = child =>
  new Promise(resolve => child.on('exit', code => resolve(code ?? 0)))

const freePort = () =>
  new Promise(resolve => {
    const server = net.createServer()
    server.listen(0, () => {
      const { port: assigned } = server.address()
      server.close(() => resolve(String(assigned)))
    })
  })

async function main() {
  const metroUrl = resolveMetroUrl({ port })
  const metroAlreadyRunning = metroUrl
    ? await waitForMetro(metroUrl, { timeoutMs: 0 })
    : false

  const buildPort = metroAlreadyRunning ? await freePort() : port
  const buildCode = await waitForExit(
    spawnStep([
      `run:${platform}`,
      '--no-bundler',
      '--port',
      buildPort,
      ...passthrough,
    ]),
  )
  if (buildCode !== 0) {
    console.error(
      `[dev-run] \`expo run:${platform}\` a échoué (code ${buildCode}).`,
    )
    process.exit(buildCode)
  }

  if (metroAlreadyRunning) {
    console.log(
      `[dev-run] Metro tourne déjà sur ${metroUrl} — pas de second serveur.`,
    )
    const ok = await openDevClient({ platform, port, device: argOf('device') })
    process.exit(ok ? 0 : 1)
  }

  const metro = spawnStep([
    'start',
    '--dev-client',
    '--lan',
    '--scheme',
    'relock',
    '--port',
    port,
  ])
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => metro.kill(signal))
  }

  // Metro tourne au premier plan ; on attend qu'il réponde avant de connecter l'app.
  openDevClient({ platform, port, device: argOf('device'), waitMs: 120_000 })

  process.exit(await waitForExit(metro))
}

main()
