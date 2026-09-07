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
 *
 * ⚠️ Ne PAS ajouter `--port` à l'étape de build : Expo CLI rejette désormais
 * `--port` et `--no-bundler` ensemble (« mutually exclusive arguments »), et
 * `npm run ios` échoue alors avant même de compiler. C'est cohérent —
 * `--no-bundler` signifie précisément qu'aucun serveur n'est démarré, donc
 * aucun port à réserver. (Le code réservait auparavant un port libre pour un
 * « serveur headless éphémère » qui n'existe pas.)
 *
 * Usage : node scripts/dev-run.cjs --platform ios [-- <args passés à expo run>]
 */
const { spawn } = require('node:child_process')
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

const spawnStep = (args, extraEnv) =>
  spawn('npx', ['expo', ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  })

const waitForExit = child =>
  new Promise(resolve => child.on('exit', code => resolve(code ?? 0)))

async function main() {
  const metroUrl = resolveMetroUrl({ port })
  const metroAlreadyRunning = metroUrl
    ? await waitForMetro(metroUrl, { timeoutMs: 0 })
    : false

  // Quand un Metro occupe déjà le port, `expo run` — bien qu'en `--no-bundler`
  // — demande « Use port 8082 instead? » et BLOQUE le terminal en attendant
  // une réponse. La question n'a pourtant aucun sens ici : `--no-bundler` dit
  // justement qu'on ne veut aucun serveur. `CI=1` la fait trancher toute
  // seule (« Skipping dev server »), sans toucher au cas normal où aucun
  // Metro ne tourne et où l'interactivité reste utile.
  const buildCode = await waitForExit(
    spawnStep(
      [`run:${platform}`, '--no-bundler', ...passthrough],
      metroAlreadyRunning ? { CI: '1' } : undefined,
    ),
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
