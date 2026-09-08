/**
 * Détecte le débordement horizontal sur mobile, page par page.
 *
 * POURQUOI
 * Un site qui défile latéralement sur un iPhone est à la fois une mauvaise
 * expérience et un signal négatif d'ergonomie mobile. Le problème est invisible
 * sur un écran large : il n'apparaît qu'en dessous d'une certaine largeur, et
 * une capture d'écran le montre comme un simple texte coupé, sans dire lequel
 * des cent éléments de la page dépasse. Ce script demande la réponse au
 * navigateur : il liste les éléments dont la bordure droite sort du viewport.
 *
 * Pilote Chrome via le protocole DevTools, sans dépendance : Node 22+ fournit
 * WebSocket nativement, et Chrome est déjà installé sur la machine.
 *
 *   node src/legal/seo-relock/tools/check-mobile.mjs [baseUrl] [largeur]
 *
 * Le serveur local doit tourner (`npm run legal:dev`, port 8788 par défaut).
 */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SEO = path.resolve(here, '..')
const config = JSON.parse(await readFile(path.join(SEO, 'pages.json'), 'utf8'))

const BASE = process.argv[2] ?? 'http://127.0.0.1:8788'
const WIDTH = Number(process.argv[3] ?? 390) // iPhone 14/15/16, la largeur la plus courante
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333

const paths = [
  ...config.pages.flatMap((p) => [p.en.path, p.fr.path]),
  '/404-inexistant-pour-tester-la-page-404',
]

const profile = await mkdtemp(path.join(tmpdir(), 'relock-cdp-'))
const chrome = spawn(
  CHROME,
  [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--window-size=' + WIDTH + ',844',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function endpoint() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      return (await res.json()).webSocketDebuggerUrl
    } catch {
      await sleep(200)
    }
  }
  throw new Error('Chrome ne répond pas sur le port de débogage')
}

const ws = new WebSocket(await endpoint())
await new Promise((r) => ws.addEventListener('open', r, { once: true }))

let id = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
const send = (method, params = {}, sessionId) =>
  new Promise((resolve) => {
    const n = ++id
    pending.set(n, resolve)
    ws.send(JSON.stringify({ id: n, method, params, sessionId }))
  })

const { result: target } = await send('Target.createTarget', { url: 'about:blank' })
const { result: attached } = await send('Target.attachToTarget', {
  targetId: target.targetId,
  flatten: true,
})
const session = attached.sessionId

await send('Page.enable', {}, session)
await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
}, session)

/** Renvoie les éléments qui dépassent, plus la largeur réelle du document. */
const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const over = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') continue;
    if (r.right > vw + 1 || r.left < -1) {
      over.push(el.tagName.toLowerCase()
        + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '')
        + '  [' + Math.round(r.left) + ' → ' + Math.round(r.right) + ']');
    }
  }
  // Cibles tactiles autonomes trop petites. Les liens INLINE (dans un
  // paragraphe, une liste, une cellule) sont exclus : ils font la hauteur de
  // leur ligne de texte par nature, et les grossir casserait l'interlignage.
  // Ne restent que les boutons, entrées de navigation et liens de bloc, pour
  // lesquels 44 px est la cible d'Apple comme de Google.
  const small = [];
  for (const el of document.querySelectorAll('a, button, summary')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (el.closest('p, li, td, th')) continue;
    if (r.height < 44) small.push((el.textContent || '').trim().slice(0, 40) + ' (' + Math.round(r.height) + 'px)');
  }
  return JSON.stringify({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: vw,
    over: over.slice(0, 12),
    small: small.slice(0, 8),
  });
})()`

let failures = 0
for (const p of paths) {
  await send('Page.navigate', { url: BASE + p }, session)
  await sleep(900)
  const { result } = await send(
    'Runtime.evaluate',
    { expression: PROBE, returnByValue: true },
    session,
  )
  const data = JSON.parse(result.result.value)
  const overflow = data.scrollWidth > data.clientWidth
  const label = overflow ? '✗' : '✓'
  console.log(`${label} ${p}  document ${data.scrollWidth}px / viewport ${data.clientWidth}px`)
  if (overflow) {
    failures++
    for (const o of data.over) console.log(`      déborde : ${o}`)
  }
  for (const s of data.small) console.log(`      cible tactile basse : ${s}`)
}

ws.close()
chrome.kill()
console.log(
  failures
    ? `\n${failures} page(s) débordent horizontalement à ${WIDTH}px.`
    : `\nAucun débordement horizontal à ${WIDTH}px.`,
)
process.exit(failures ? 1 : 0)
