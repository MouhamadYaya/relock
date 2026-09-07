/**
 * Génère les images du site public getrelock.com (`src/legal/`).
 *
 * POURQUOI CE SCRIPT
 * La landing servait trois captures PNG 1920x1440 pesant 3,73 Mo à elles seules,
 * dont 1,78 Mo sur l'image LCP du hero. Un site de huit pages statiques n'a aucune
 * raison d'être plus lourd qu'une application. Les sources restent versionnées en
 * PNG (elles viennent du simulateur, on ne les regénère pas), la sortie servie est
 * en WebP, redimensionnée à la largeur d'affichage réelle.
 *
 * Le script produit aussi ce que le HTML seul ne peut pas fabriquer :
 *   - `og-cover.png`, l'image sociale 1200x630 (aucune n'existait, donc tout
 *     partage du lien affichait une vignette vide) ;
 *   - `apple-touch-icon.png` et les icônes du manifeste, tirées de l'icône d'app
 *     iOS déjà présente dans le dépôt.
 *
 * Idempotent : chaque sortie est comparée à un manifeste de hachages
 * (`src/legal/.generated-assets.json`). Une source inchangée n'est pas réencodée.
 *
 * Usage : node scripts/build-legal-assets.cjs [--check] [--force]
 *   --check  n'écrit rien, sort en 1 si une sortie est absente ou périmée (CI)
 *   --force  réencode tout, même si le manifeste dit que c'est à jour
 */
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const sharp = require('sharp')

const root = path.join(__dirname, '..')
const LEGAL = path.join(root, 'src', 'legal')
const FONTS = path.join(LEGAL, 'assets', 'fonts')
const MANIFEST = path.join(LEGAL, '.generated-assets.json')
const APP_ICON = path.join(
  root,
  'ios/Relock/Images.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png',
)

/** Palette du site, alignée sur `src/legal/styles.css` (`:root`). */
const COLOR = {
  canvas: '#05060b',
  ink: '#f7f6fc',
  inkSoft: '#b6b6c7',
  violet: '#a78bfa',
}

/**
 * Captures produit servies par la landing.
 *
 * Les noms de sortie sont descriptifs et en anglais : le nom de fichier est un
 * signal pour Google Images, et `EcranCreationDeRegledeBlocageEtEcranDEblocage.png`
 * n'en était pas un.
 */
const SCREENSHOTS = [
  {
    from: 'ecranAcceuilETActivite.png',
    to: 'relock-home-activity.webp',
    width: 1600,
  },
  {
    from: 'EcranConfigurationBlocage.png',
    to: 'relock-app-selection-rules.webp',
    width: 1600,
  },
  {
    from: 'EcranCreationDeRegledeBlocageEtEcranDEblocage.png',
    to: 'relock-rule-creation-pause.webp',
    width: 1600,
  },
]

/** Icônes dérivées de l'icône d'app iOS. */
const ICONS = [
  { to: 'apple-touch-icon.png', size: 180 },
  { to: 'icon-192.png', size: 192 },
  { to: 'icon-512.png', size: 512 },
]

const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const FORCE = args.includes('--force')

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex')

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Le rendu de texte passe par Pango (via sharp), auquel on fournit directement le
 * fichier de police : la machine n'a pas Inter installée, et on veut la police de
 * la marque, pas un repli système qui changerait d'une machine à l'autre.
 */
async function text({ value, font, fontfile, color, width, spacing = 0 }) {
  return sharp({
    text: {
      text: `<span foreground="${color}" letter_spacing="${spacing}">${value}</span>`,
      font,
      fontfile: path.join(FONTS, fontfile),
      rgba: true,
      width,
      wrap: 'word',
      align: 'left',
    },
  })
    .png()
    .toBuffer()
}

/**
 * Carte sociale 1200x630 : fond de marque, halo violet, accroche de la landing,
 * et la capture du hero détourée à droite. Aucun chiffre, aucune promesse qui ne
 * soit pas déjà sur la page — une carte sociale est une citation de la page, pas
 * un support publicitaire autonome.
 */
async function buildOgCover() {
  const W = 1200
  const H = 630

  const backdrop = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <radialGradient id="glow" cx="0.74" cy="0.14" r="0.85">
          <stop offset="0%" stop-color="${COLOR.violet}" stop-opacity="0.30" />
          <stop offset="55%" stop-color="${COLOR.violet}" stop-opacity="0.06" />
          <stop offset="100%" stop-color="${COLOR.canvas}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="${COLOR.canvas}" />
      <rect width="${W}" height="${H}" fill="url(#glow)" />
      <rect x="0" y="${H - 8}" width="${W}" height="8" fill="${COLOR.violet}" />
    </svg>`,
  )

  const [wordmark, headline, subline, domain, shot] = await Promise.all([
    sharp(path.join(LEGAL, 'assets', 'relock-wordmark.png'))
      .resize({ width: 208 })
      .png()
      .toBuffer(),
    text({
      value: 'Stop opening apps\non autopilot.',
      font: 'Inter Bold 44',
      fontfile: 'Inter-Bold.ttf',
      color: COLOR.ink,
      width: 620,
      spacing: -900,
    }),
    text({
      value: 'One intentional pause between you and the scroll.',
      font: 'Inter Regular 21',
      fontfile: 'Inter-Regular.ttf',
      color: COLOR.inkSoft,
      width: 560,
    }),
    text({
      value: 'getrelock.com',
      font: 'Inter Medium 18',
      fontfile: 'Inter-Medium.ttf',
      color: COLOR.violet,
      width: 320,
    }),
    sharp(path.join(LEGAL, 'ecranAcceuilETActivite.png'))
      .extract({ left: 980, top: 0, width: 940, height: 1440 })
      .resize({ width: 430, height: 560, fit: 'cover', position: 'top' })
      .composite([
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="430" height="560">
               <rect width="430" height="560" rx="26" ry="26" fill="#fff" />
             </svg>`,
          ),
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer(),
  ])

  return sharp(backdrop)
    .composite([
      { input: shot, left: 716, top: 104 },
      { input: wordmark, left: 72, top: 76 },
      { input: headline, left: 68, top: 182 },
      { input: subline, left: 72, top: 338 },
      { input: domain, left: 72, top: 404 },
    ])
    .png({ quality: 90, compressionLevel: 9, palette: true })
    .toBuffer()
}

/** Écrit `buf` dans `rel`, ou signale l'écart en mode --check. Renvoie true si à jour. */
function emit(rel, buf, report) {
  const abs = path.join(LEGAL, rel)
  const digest = sha256(buf)
  const current = fs.existsSync(abs) ? sha256(fs.readFileSync(abs)) : null

  if (current === digest) return true
  if (CHECK) {
    report.push(current === null ? `manquant : ${rel}` : `périmé : ${rel}`)
    return false
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, buf)
  const kb = (buf.length / 1024).toFixed(0)
  console.log(`  écrit  ${rel} (${kb} Ko)`)
  return true
}

async function main() {
  const previous = readManifest()
  const state = {}
  const report = []

  /** Une entrée du manifeste vaut preuve de fraîcheur : source + sortie inchangées. */
  const upToDate = (key, sourceDigest) => {
    if (FORCE) return false
    const abs = path.join(LEGAL, key)
    if (!fs.existsSync(abs)) return false
    const entry = previous[key]
    return typeof entry === 'object' && entry.source === sourceDigest
  }

  for (const shot of SCREENSHOTS) {
    const src = path.join(LEGAL, shot.from)
    if (!fs.existsSync(src)) {
      // La source PNG a été retirée du dépôt : la sortie WebP fait foi.
      if (fs.existsSync(path.join(LEGAL, shot.to))) continue
      report.push(`source absente : ${shot.from}`)
      continue
    }
    const sourceDigest = sha256(fs.readFileSync(src))
    if (upToDate(shot.to, sourceDigest)) {
      state[shot.to] = previous[shot.to]
      continue
    }
    const buf = await sharp(src)
      .resize({ width: shot.width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 })
      .toBuffer()
    const ok = emit(shot.to, buf, report)
    if (ok) state[shot.to] = { source: sourceDigest, output: sha256(buf) }
  }

  const iconSource = fs.existsSync(APP_ICON)
    ? sha256(fs.readFileSync(APP_ICON))
    : null
  if (iconSource) {
    for (const icon of ICONS) {
      if (upToDate(icon.to, iconSource)) {
        state[icon.to] = previous[icon.to]
        continue
      }
      const buf = await sharp(APP_ICON)
        .resize({ width: icon.size, height: icon.size, fit: 'cover' })
        .png({ compressionLevel: 9 })
        .toBuffer()
      const ok = emit(icon.to, buf, report)
      if (ok) state[icon.to] = { source: iconSource, output: sha256(buf) }
    }
  } else {
    report.push(`source absente : ${path.relative(root, APP_ICON)}`)
  }

  const ogSource = sha256(
    Buffer.concat([
      fs.readFileSync(path.join(LEGAL, 'assets', 'relock-wordmark.png')),
      fs.readFileSync(path.join(LEGAL, 'ecranAcceuilETActivite.png')),
      fs.readFileSync(__filename),
    ]),
  )
  if (upToDate('og-cover.png', ogSource)) {
    state['og-cover.png'] = previous['og-cover.png']
  } else {
    const buf = await buildOgCover()
    const ok = emit('og-cover.png', buf, report)
    if (ok) state['og-cover.png'] = { source: ogSource, output: sha256(buf) }
  }

  if (CHECK) {
    if (report.length > 0) {
      console.error('Assets du site legal périmés :')
      for (const line of report) console.error(`  - ${line}`)
      console.error('\nLance `npm run legal:assets` puis commite le résultat.')
      process.exit(1)
    }
    console.log('Assets du site legal à jour.')
    return
  }

  fs.writeFileSync(MANIFEST, `${JSON.stringify(state, null, 2)}\n`)
  console.log('Assets du site legal générés.')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
