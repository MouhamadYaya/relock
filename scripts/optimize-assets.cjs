/**
 * Compresse en place les PNG/JPG d'assets/ réellement embarqués dans l'app.
 *
 * Metro n'empaquette QUE les assets atteints par un `require('@assets/…')` :
 * ce script part donc du code source, pas du contenu du dossier. Les maquettes
 * de référence non référencées (assets/paywall/*) sont ignorées — elles ne
 * pèsent pas dans le binaire.
 *
 * Stratégie par fichier : quantification palette (sharp, équivalent pngquant).
 * Si le gain est faible (< MIN_GAIN), la palette dégraderait l'image sans
 * contrepartie : on retombe alors sur une recompression sans perte.
 *
 * Idempotent : `assets/.optimized.json` mémorise le sha256 de chaque sortie.
 * Un fichier inchangé depuis son optimisation est sauté ; un fichier remplacé
 * par un designer est réoptimisé automatiquement.
 *
 * Usage : node scripts/optimize-assets.cjs [--dry-run]
 */
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const sharp = require('sharp')

const root = path.join(__dirname, '..')
const ASSETS_DIR = path.join(root, 'assets')
const MANIFEST = path.join(ASSETS_DIR, '.optimized.json')
const SOURCE_DIRS = [path.join(root, 'src'), path.join(root, 'app')]

/** Sous le seuil, la quantification palette ne vaut pas sa perte de qualité. */
const MIN_GAIN = 0.25
const PALETTE_QUALITY = 82
const JPEG_QUALITY = 82
/** Variantes de densité que Metro embarque avec l'asset de base. */
const DENSITY_SUFFIXES = ['', '@2x', '@3x']
/**
 * Jamais touchés : source de vérité du bootsplash (`bootsplash:generate` et
 * `gen:app-icon` en dérivent tout le reste) et sorties natives générées.
 */
const NEVER_TOUCH = [/^logo\.png$/, /^app-icon\.png$/, /^bootsplash\//]

const dryRun = process.argv.includes('--dry-run')

/** Tous les fichiers source susceptibles de contenir un require d'asset. */
function collectSourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectSourceFiles(full, out)
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

/** Chemins d'assets référencés via l'alias @assets/, variantes comprises. */
function collectReferencedAssets() {
  const pattern = /@assets\/([A-Za-z0-9_./-]+\.(?:png|jpe?g))/g
  const referenced = new Set()
  for (const file of collectSourceFiles(SOURCE_DIRS[0]).concat(
    collectSourceFiles(SOURCE_DIRS[1]),
  )) {
    const code = fs.readFileSync(file, 'utf8')
    for (const match of code.matchAll(pattern)) {
      referenced.add(match[1])
    }
  }

  const files = []
  for (const rel of referenced) {
    if (NEVER_TOUCH.some(re => re.test(rel))) {
      continue
    }
    const ext = path.extname(rel)
    const base = rel.slice(0, -ext.length)
    for (const suffix of DENSITY_SUFFIXES) {
      const candidate = path.join(ASSETS_DIR, `${base}${suffix}${ext}`)
      if (fs.existsSync(candidate)) {
        files.push(candidate)
      }
    }
  }
  return files.sort()
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Meilleure recompression pour un fichier donné.
 * @returns {Promise<Buffer>}
 */
async function compress(file, original) {
  if (/\.jpe?g$/i.test(file)) {
    return sharp(original)
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer()
  }

  const palette = await sharp(original)
    .png({ palette: true, quality: PALETTE_QUALITY, effort: 10 })
    .toBuffer()
  if (1 - palette.length / original.length >= MIN_GAIN) {
    return palette
  }
  // Gain insuffisant : on garde toutes les couleurs, on ne joue que sur zlib.
  return sharp(original)
    .png({ palette: false, compressionLevel: 9, effort: 10 })
    .toBuffer()
}

async function main() {
  const files = collectReferencedAssets()
  const manifest = readManifest()

  let totalBefore = 0
  let totalAfter = 0
  let optimized = 0
  let skipped = 0

  for (const file of files) {
    const rel = path.relative(ASSETS_DIR, file)
    const original = fs.readFileSync(file)
    const currentHash = sha256(original)

    if (manifest[rel] === currentHash) {
      skipped += 1
      totalBefore += original.length
      totalAfter += original.length
      continue
    }

    const output = await compress(file, original)
    totalBefore += original.length

    // Ne jamais grossir un fichier : certaines images sont déjà optimales.
    if (output.length >= original.length) {
      manifest[rel] = currentHash
      totalAfter += original.length
      skipped += 1
      continue
    }

    totalAfter += output.length
    optimized += 1
    const gain = (100 - (output.length / original.length) * 100).toFixed(0)
    const kb = n => `${(n / 1024).toFixed(0)} KB`
    console.log(
      `  ${rel.padEnd(44)} ${kb(original.length).padStart(8)} → ${kb(output.length).padStart(8)}  -${gain}%`,
    )

    if (!dryRun) {
      fs.writeFileSync(file, output)
      manifest[rel] = sha256(output)
    }
  }

  if (!dryRun) {
    fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  }

  const mb = n => `${(n / 1024 / 1024).toFixed(2)} MB`
  console.log(
    `\n${dryRun ? '[dry-run] ' : ''}${optimized} optimisé(s), ${skipped} inchangé(s)`,
  )
  console.log(
    `Poids embarqué : ${mb(totalBefore)} → ${mb(totalAfter)} (-${(100 - (totalAfter / totalBefore) * 100).toFixed(0)}%)`,
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
