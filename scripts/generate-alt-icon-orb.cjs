/**
 * Rend l'icône alternative « Orbe » depuis sa source vectorielle.
 *
 *   assets/app-icon-orb.svg
 *     → ios/Relock/Images.xcassets/AppIcon-Orb.appiconset/Icon-Orb-*.png
 *     → assets/logo-orb{,@2x,@3x}.png   (l'aperçu du sélecteur des Réglages)
 *
 * Pourquoi un script et non un export à la main : l'aperçu montré dans les
 * Réglages et l'icône réellement posée par iOS DOIVENT être le même dessin.
 * Choisir sur une vignette et obtenir autre chose sur l'écran d'accueil est
 * le seul vrai défaut possible de cet écran — on ne le verrait qu'après avoir
 * quitté l'app.
 *
 * Les PNG sont aplatis sur le mauve du dessin : une icône iOS n'a pas droit à
 * la transparence, et le canal alpha d'un rendu SVG suffit à faire refuser
 * une soumission App Store.
 *
 *   node scripts/generate-alt-icon-orb.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const sharp = require('sharp')

const root = path.join(__dirname, '..')
const SOURCE = path.join(root, 'assets', 'app-icon-orb.svg')
const ICONSET = path.join(
  root,
  'ios',
  'Relock',
  'Images.xcassets',
  'AppIcon-Orb.appiconset',
)
const ASSETS = path.join(root, 'assets')

/** Le mauve du coin haut-gauche du fond — la couleur d'aplatissement. */
const FLATTEN = '#E9DAFC'

/** Densité de rastérisation : au-dessus du plus grand rendu, jamais dessous. */
const DENSITY = 384

/** Les fentes iOS, telles que les nomme déjà `Contents.json`. */
const IOS_SLOTS = [
  { px: 40, filename: 'Icon-Orb-20x20@2x.png' },
  { px: 60, filename: 'Icon-Orb-20x20@3x.png' },
  { px: 58, filename: 'Icon-Orb-29x29@2x.png' },
  { px: 87, filename: 'Icon-Orb-29x29@3x.png' },
  { px: 80, filename: 'Icon-Orb-40x40@2x.png' },
  { px: 120, filename: 'Icon-Orb-40x40@3x.png' },
  { px: 120, filename: 'Icon-Orb-60x60@2x.png' },
  { px: 180, filename: 'Icon-Orb-60x60@3x.png' },
  { px: 1024, filename: 'Icon-Orb-1024x1024@1x.png' },
]

/** L'aperçu du sélecteur, aux trois densités de React Native. */
const PREVIEW_SLOTS = [
  { px: 128, filename: 'logo-orb.png' },
  { px: 256, filename: 'logo-orb@2x.png' },
  { px: 384, filename: 'logo-orb@3x.png' },
]

async function render(px, out) {
  await sharp(SOURCE, { density: DENSITY })
    .resize(px, px, { fit: 'cover' })
    .flatten({ background: FLATTEN })
    // Palette pour les petites fentes (poids divisé par trois, aucun écart
    // visible) ; couleurs pleines pour l'icône marketing 1024, où la
    // quantification se verrait en bandes dans le dégradé du fond.
    .png({ compressionLevel: 9, palette: px <= 512 })
    .toFile(out)
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`[icon-orb] source introuvable : ${SOURCE}`)
    process.exit(1)
  }

  for (const slot of IOS_SLOTS) {
    await render(slot.px, path.join(ICONSET, slot.filename))
  }
  for (const slot of PREVIEW_SLOTS) {
    await render(slot.px, path.join(ASSETS, slot.filename))
  }

  console.log(
    `[icon-orb] ${IOS_SLOTS.length} icônes iOS + ${PREVIEW_SLOTS.length} aperçus rendus depuis app-icon-orb.svg`,
  )
}

main().catch(error => {
  console.error('[icon-orb]', error)
  process.exit(1)
})
