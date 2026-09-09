/**
 * Rend les DEUX icônes alternatives depuis leur source, aux neuf tailles iOS
 * et aux trois densités de l'aperçu montré dans les Réglages.
 *
 *   assets/app-icon-orb.svg     → AppIcon-Orb.appiconset/*    + logo-orb*.png
 *   assets/app-icon-phases.png  → AppIcon-Phases.appiconset/* + logo-phases*.png
 *
 * Pourquoi un script et non un export à la main : l'aperçu montré dans les
 * Réglages et l'icône réellement posée par iOS DOIVENT être le même dessin.
 * Choisir sur une vignette et obtenir autre chose sur l'écran d'accueil est le
 * seul vrai défaut possible de cet écran — on ne le verrait qu'après avoir
 * quitté l'app.
 *
 * Les PNG sont aplatis sur la couleur de fond du dessin : une icône iOS n'a
 * pas droit à la transparence, et le canal alpha d'un rendu SVG suffit à faire
 * refuser une soumission App Store.
 *
 * ⚠️ Les icônes sont COMPILÉES DANS LE BINAIRE (`Assets.car`). Relancer ce
 * script ne change rien sur l'appareil tant que l'app n'est pas reconstruite.
 *
 *   node scripts/generate-alt-icons.cjs           # les deux
 *   node scripts/generate-alt-icons.cjs orb       # une seule
 */
const fs = require('node:fs')
const path = require('node:path')

const sharp = require('sharp')

const root = path.join(__dirname, '..')
const ASSETS = path.join(root, 'assets')
const XCASSETS = path.join(root, 'ios', 'Relock', 'Images.xcassets')

/** Densité de rastérisation d'une source SVG : au-dessus du plus grand rendu. */
const DENSITY = 384

/** Les huit fentes iPhone plus l'icône marketing, dans l'ordre de `Contents.json`. */
const SLOTS = [40, 60, 58, 87, 80, 120, 120, 180, 1024]

const VARIANTS = {
  orb: {
    source: path.join(ASSETS, 'app-icon-orb.svg'),
    iconset: path.join(XCASSETS, 'AppIcon-Orb.appiconset'),
    /** Le violet nocturne du coin de l'image — la couleur d'aplatissement. */
    flatten: '#07050F',
    files: [
      'Icon-Orb-20x20@2x.png',
      'Icon-Orb-20x20@3x.png',
      'Icon-Orb-29x29@2x.png',
      'Icon-Orb-29x29@3x.png',
      'Icon-Orb-40x40@2x.png',
      'Icon-Orb-40x40@3x.png',
      'Icon-Orb-60x60@2x.png',
      'Icon-Orb-60x60@3x.png',
      'Icon-Orb-1024x1024@1x.png',
    ],
    preview: 'logo-orb',
  },
  phases: {
    source: path.join(ASSETS, 'app-icon-phases.png'),
    iconset: path.join(XCASSETS, 'AppIcon-Phases.appiconset'),
    flatten: '#000000',
    files: [
      'Icon-Phases-20x20@2x.png',
      'Icon-Phases-20x20@3x.png',
      'Icon-Phases-29x29@2x.png',
      'Icon-Phases-29x29@3x.png',
      'Icon-Phases-40x40@2x.png',
      'Icon-Phases-40x40@3x.png',
      'Icon-Phases-60x60@2x.png',
      'Icon-Phases-60x60@3x.png',
      'Icon-Phases-1024x1024@1x.png',
    ],
    preview: 'logo-phases',
  },
}

/** L'aperçu du sélecteur, aux trois densités de React Native. */
const PREVIEW_SLOTS = [
  { px: 128, suffix: '' },
  { px: 256, suffix: '@2x' },
  { px: 384, suffix: '@3x' },
]

async function render(variant, px, out) {
  await sharp(variant.source, { density: DENSITY })
    .resize(px, px, { fit: 'cover', kernel: 'lanczos3' })
    .flatten({ background: variant.flatten })
    // Palette pour les petites fentes (poids divisé par trois, aucun écart
    // visible) ; couleurs pleines pour l'icône marketing 1024, où la
    // quantification se verrait en bandes dans le dégradé du fond.
    .png({ compressionLevel: 9, palette: px <= 512 })
    .toFile(out)
}

async function build(name) {
  const variant = VARIANTS[name]
  if (!fs.existsSync(variant.source)) {
    throw new Error(`source introuvable : ${variant.source}`)
  }

  for (const [index, px] of SLOTS.entries()) {
    await render(variant, px, path.join(variant.iconset, variant.files[index]))
  }
  for (const slot of PREVIEW_SLOTS) {
    await render(
      variant,
      slot.px,
      path.join(ASSETS, `${variant.preview}${slot.suffix}.png`),
    )
  }

  console.log(
    `[alt-icons] ${name} : ${SLOTS.length} icônes iOS + ${PREVIEW_SLOTS.length} aperçus`,
  )
}

async function main() {
  const asked = process.argv.slice(2)
  const names = asked.length > 0 ? asked : Object.keys(VARIANTS)

  for (const name of names) {
    if (!VARIANTS[name]) {
      console.error(
        `[alt-icons] variante inconnue : ${name} (attendu : ${Object.keys(VARIANTS).join(', ')})`,
      )
      process.exit(1)
    }
    await build(name)
  }
}

main().catch(error => {
  console.error('[alt-icons]', error)
  process.exit(1)
})
