/**
 * Pipeline d'images du site public — src/legal/img/.
 *
 * POURQUOI
 * Les trois captures d'écran de la landing pesaient 3,6 Mo de PNG pour un
 * rendu de 720 px de large. Le LCP de la page d'accueil, c'est la première
 * d'entre elles : elle valait à elle seule 1,8 Mo. Ce script les redécoupe en
 * AVIF + WebP à plusieurs largeurs, plus un PNG de repli, et leur donne des
 * noms de fichier descriptifs (Google Images lit le nom du fichier).
 *
 * IDEMPOTENT — relançable sans risque, il réécrit toujours la même sortie.
 *
 *   node src/legal/seo-relock/tools/build-images.mjs
 *
 * Les sources restent dans seo-relock/sources/ (non publiées, cf. .assetsignore).
 */
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const SITE = path.resolve(here, '../..') // src/legal
const SOURCES = path.join(here, '..', 'sources')
const OUT = path.join(SITE, 'img')

/**
 * Les captures rendent au maximum 720 px CSS (`width: min(720px, 100%)`).
 * 1440 couvre le 2× ; 1920 est la source et couvre le 3× sur les plus grands
 * iPhone. Au-delà on n'aurait plus de pixels à donner.
 */
const WIDTHS = [480, 720, 1080, 1440, 1920]

/** name = nom publié, source = fichier d'origine. */
const SCREENSHOTS = [
  {
    source: 'ecranAcceuilETActivite.png',
    name: 'relock-home-and-activity-screens',
  },
  {
    source: 'EcranConfigurationBlocage.png',
    name: 'relock-app-selection-and-blocking-rule',
  },
  {
    source: 'EcranCreationDeRegledeBlocageEtEcranDEblocage.png',
    name: 'relock-rule-creation-and-blocked-app-pause',
  },
]

const kb = (n) => `${(n / 1024).toFixed(0)} KB`

async function sizeOf(file) {
  return (await stat(file)).size
}

async function buildScreenshot({ source, name }) {
  const src = path.join(SOURCES, source)
  const base = sharp(src)
  const meta = await base.metadata()
  const report = []

  for (const w of WIDTHS) {
    if (w > meta.width) continue
    const resized = () => sharp(src).resize({ width: w, withoutEnlargement: true })

    const avif = path.join(OUT, `${name}-${w}.avif`)
    await resized().avif({ quality: 52, effort: 6, chromaSubsampling: '4:2:0' }).toFile(avif)

    const webp = path.join(OUT, `${name}-${w}.webp`)
    await resized().webp({ quality: 76, effort: 6 }).toFile(webp)

    report.push({ w, avif: await sizeOf(avif), webp: await sizeOf(webp) })
  }

  // Repli universel : un seul PNG, à la largeur utile en 2×. Aucun navigateur
  // moderne ne le téléchargera (AVIF depuis Safari 16 / Chrome 85), mais il
  // garantit que l'image s'affiche partout, y compris pour un crawler ancien.
  const png = path.join(OUT, `${name}-1440.png`)
  await sharp(src)
    .resize({ width: 1440 })
    .png({ compressionLevel: 9, effort: 10, palette: true, quality: 88, dither: 0.6 })
    .toFile(png)

  const before = await sizeOf(src)
  const after = report.find((r) => r.w === 1440)
  console.log(
    `${name}\n  source ${kb(before)} → avif@1440 ${kb(after.avif)} · webp@1440 ${kb(after.webp)} · png@1440 ${kb(await sizeOf(png))}`,
  )
  return report
}

/**
 * Image Open Graph 1200×630, composée uniquement d'assets réels du dépôt :
 * l'icône d'app iOS, le lettrage Relock, le grain de fond du site. Aucun
 * chiffre, aucune note, aucune récompense — rien qui puisse être faux.
 */
async function buildOgImage({ locale, tagline, out }) {
  const W = 1200
  const H = 630

  const backdrop = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <radialGradient id="violet" cx="82%" cy="6%" r="70%">
          <stop offset="0%" stop-color="#7357dc" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="#7357dc" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="blue" cx="14%" cy="88%" r="62%">
          <stop offset="0%" stop-color="#68c7f2" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="#68c7f2" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="#05060B"/>
      <rect width="${W}" height="${H}" fill="url(#violet)"/>
      <rect width="${W}" height="${H}" fill="url(#blue)"/>
    </svg>`)

  const text = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <style>
        .lede { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
                font-size: 44px; font-weight: 500; fill: #EDEBF6; letter-spacing: -1.4px; }
        .foot { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
                font-size: 25px; font-weight: 500; fill: #9B9AAE; letter-spacing: 0.2px; }
      </style>
      ${tagline
        .map((line, i) => `<text class="lede" x="96" y="${372 + i * 58}">${line}</text>`)
        .join('\n      ')}
      <text class="foot" x="96" y="${372 + tagline.length * 58 + 34}">getrelock.com</text>
    </svg>`)

  const grain = await sharp(path.join(SITE, 'assets', 'home-grain.png'))
    .resize(128, 128)
    .composite([{ input: Buffer.from([255, 255, 255, 26]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const icon = await sharp(
    path.resolve(SITE, '../../ios/Relock/Images.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png'),
  )
    .resize(132, 132)
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="132" height="132"><rect width="132" height="132" rx="30" fill="#fff"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer()

  const wordmark = await sharp(path.join(SITE, 'assets', 'relock-wordmark.png'))
    .resize({ width: 300 })
    .png()
    .toBuffer()

  await sharp(backdrop)
    .composite([
      { input: grain, tile: true, blend: 'over' },
      { input: icon, top: 92, left: 96 },
      { input: wordmark, top: 118, left: 258 },
      { input: text, top: 0, left: 0 },
    ])
    // JPEG plutôt que PNG : le grain fait exploser un PNG (387 Ko) sans rien
    // apporter à une vignette sociale, qui est de toute façon recompressée.
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile(out)

  console.log(`og:${locale} → ${path.relative(SITE, out)} ${kb(await sizeOf(out))}`)
}

/** Icône de démarrage iOS + PNG de secours pour les agrégateurs. */
async function buildIcons() {
  const src = path.resolve(
    SITE,
    '../../ios/Relock/Images.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png',
  )
  for (const size of [180, 192, 512]) {
    const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`
    await sharp(src).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(OUT, name))
  }
  console.log('icons → apple-touch-icon.png, icon-192.png, icon-512.png')
}

async function main() {
  await mkdir(OUT, { recursive: true })
  // Repartir propre : une largeur retirée de WIDTHS doit disparaître du site.
  for (const f of await readdir(OUT).catch(() => [])) {
    await rm(path.join(OUT, f), { force: true })
  }

  for (const shot of SCREENSHOTS) await buildScreenshot(shot)

  await buildOgImage({
    locale: 'en',
    out: path.join(OUT, 'relock-og-en.jpg'),
    tagline: ['An iPhone app blocker for people', 'who open apps without deciding to.'],
  })
  await buildOgImage({
    locale: 'fr',
    out: path.join(OUT, 'relock-og-fr.jpg'),
    tagline: ['Un bloqueur d’applications iPhone', 'pour les ouvertures qu’on n’a pas décidées.'],
  })

  await buildIcons()

  const total = (await readdir(OUT)).length
  console.log(`\n${total} fichiers dans src/legal/img/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
