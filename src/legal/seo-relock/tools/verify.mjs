/**
 * Contrôle SEO du site publié — src/legal/.
 *
 * POURQUOI CE SCRIPT PLUTÔT QU'UNE RELECTURE
 * Les erreurs qui coûtent le plus cher en référencement sont muettes : un
 * hreflang non réciproque que Google ignore sans rien dire, un lien interne
 * vers un dossier qui n'existe pas, une image sans `width` qui décale la page
 * au chargement, deux pages qui partagent la même description. Rien de tout
 * cela n'apparaît à l'œil sur la page rendue. Ce script les cherche.
 *
 *   node src/legal/seo-relock/tools/verify.mjs
 *
 * Sort en 1 dès qu'un contrôle échoue : utilisable tel quel en CI.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SEO = path.resolve(here, '..')
const SITE = path.resolve(SEO, '..')

const config = JSON.parse(await readFile(path.join(SEO, 'pages.json'), 'utf8'))
const { origin } = config

const problems = []
const notes = []
const fail = (file, msg) => problems.push(`${file}: ${msg}`)

/** Tous les .html réellement publiés (seo-relock/ est exclu du déploiement). */
async function htmlFiles(dir = SITE, acc = []) {
  for (const name of await readdir(dir)) {
    if (name === 'seo-relock' || name === 'node_modules') continue
    const full = path.join(dir, name)
    const info = await stat(full)
    if (info.isDirectory()) await htmlFiles(full, acc)
    else if (name.endsWith('.html')) acc.push(path.relative(SITE, full))
  }
  return acc
}

const exists = (p) => stat(p).then(() => true, () => false)

// `\s` en tête, sinon `alt` matcherait aussi le `data-alt` ou le `xalt` d'à côté,
// et un attribut manquant passerait le contrôle.
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]
const plain = (h) =>
  h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()

const files = (await htmlFiles()).sort()
const indexable = new Map() // file -> { lang, path, pairFile }
for (const pair of config.pages) {
  indexable.set(pair.en.file, { ...pair.en, lang: 'en', other: pair.fr })
  indexable.set(pair.fr.file, { ...pair.fr, lang: 'fr', other: pair.en })
}
const noindex = new Set(config.noindex.map((n) => n.file))

// ---------------------------------------------------------------------------
// 1. Aucune page orpheline : tout .html publié est soit indexable et déclaré
//    dans pages.json, soit explicitement en noindex.
// ---------------------------------------------------------------------------
for (const f of files) {
  if (!indexable.has(f) && !noindex.has(f)) {
    fail(f, 'page publiée absente de pages.json (ni indexable, ni noindex)')
  }
}
for (const f of [...indexable.keys(), ...noindex]) {
  if (!files.includes(f)) fail(f, 'déclarée dans pages.json mais le fichier est absent')
}

const titles = new Map()
const descriptions = new Map()

for (const file of files) {
  const html = await readFile(path.join(SITE, file), 'utf8')
  const dir = path.dirname(path.join(SITE, file))
  const meta = indexable.get(file)
  const isNoindex = noindex.has(file)

  // -------------------------------------------------------------------------
  // 2. Base commune à toutes les pages.
  // -------------------------------------------------------------------------
  if (!/<html lang="(en|fr)">/.test(html)) fail(file, 'attribut lang manquant ou inattendu sur <html>')

  const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1]
  if (!title) fail(file, '<title> manquant')

  if (/<meta name="keywords"/i.test(html)) {
    fail(file, 'balise meta keywords présente (sans effet, et signal de sur-optimisation)')
  }

  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)]
  if (h1.length !== 1) fail(file, `${h1.length} <h1> (il en faut exactement un)`)

  // Ordre des titres : on ne saute pas de niveau (h2 → h4).
  const levels = [...html.matchAll(/<h([1-6])[^>]*>/g)].map((m) => Number(m[1]))
  let prev = 0
  for (const lvl of levels) {
    if (prev && lvl > prev + 1) {
      fail(file, `saut de niveau de titre h${prev} → h${lvl}`)
      break
    }
    prev = lvl
  }

  // -------------------------------------------------------------------------
  // 3. Images : alt obligatoire (vide autorisé pour le décoratif), dimensions
  //    obligatoires — sans elles, la page se décale au chargement (CLS).
  // -------------------------------------------------------------------------
  for (const m of html.matchAll(/<img\b[\s\S]*?>/g)) {
    const tag = m[0]
    const src = attr(tag, 'src') ?? '(sans src)'
    if (attr(tag, 'alt') === undefined) fail(file, `<img> sans attribut alt : ${src}`)
    if (!attr(tag, 'width') || !attr(tag, 'height')) {
      fail(file, `<img> sans width/height (décalage de mise en page) : ${src}`)
    }
    const alt = attr(tag, 'alt') ?? ''
    if (alt.split(/\s+/).length > 24) fail(file, `alt anormalement long : ${src}`)
  }

  // -------------------------------------------------------------------------
  // 4. Liens et ressources : tout ce qui est local doit exister sur le disque.
  //    `html_handling: auto-trailing-slash` fait pointer `foo/` sur
  //    `foo/index.html`.
  // -------------------------------------------------------------------------
  const refs = []
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) refs.push(m[1])
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) refs.push(part.trim().split(/\s+/)[0])
  }
  for (const m of html.matchAll(/imagesrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) refs.push(part.trim().split(/\s+/)[0])
  }

  for (const ref of refs) {
    if (!ref) continue
    if (/^(https?:|mailto:|tel:|data:)/.test(ref)) continue
    if (ref.startsWith('#')) {
      const id = ref.slice(1)
      if (id && !new RegExp(`id="${id}"`).test(html)) fail(file, `ancre interne morte : ${ref}`)
      continue
    }
    const [clean] = ref.split('#')
    const target = clean.startsWith('/') ? path.join(SITE, clean) : path.resolve(dir, clean)
    const candidate = clean.endsWith('/') || !path.extname(target)
      ? path.join(target, 'index.html')
      : target
    if (!(await exists(candidate))) fail(file, `lien ou ressource introuvable : ${ref}`)
  }

  if (isNoindex) {
    if (!/<meta name="robots" content="noindex/.test(html)) fail(file, 'page 404 sans meta robots noindex')
    continue
  }
  if (!meta) continue

  // -------------------------------------------------------------------------
  // 5. Canonical, hreflang, Open Graph — les pages indexables uniquement.
  // -------------------------------------------------------------------------
  const url = `${origin}${meta.path}`
  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]
  if (canonical !== url) fail(file, `canonical = ${canonical ?? 'absent'}, attendu ${url}`)

  const alts = Object.fromEntries(
    [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]),
  )
  const selfHref = `${origin}${meta.path}`
  const otherHref = `${origin}${meta.other.path}`
  if (alts[meta.lang] !== selfHref) fail(file, 'hreflang auto-référent manquant ou faux')
  if (alts[meta.lang === 'en' ? 'fr' : 'en'] !== otherHref) fail(file, 'hreflang vers l’autre langue manquant ou faux')
  if (!alts['x-default']) fail(file, 'hreflang x-default manquant')

  for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'og:site_name', 'og:type']) {
    if (!html.includes(`property="${tag}"`)) fail(file, `balise ${tag} manquante`)
  }
  const ogUrl = /<meta property="og:url" content="([^"]+)"/.exec(html)?.[1]
  if (ogUrl !== url) fail(file, `og:url = ${ogUrl}, attendu ${url}`)

  const desc = /<meta name="description" content="([^"]+)"/.exec(html)?.[1]
  if (!desc) fail(file, 'meta description manquante')

  // Titres et descriptions uniques : deux pages qui les partagent se
  // concurrencent sur la même requête.
  if (titles.has(title)) fail(file, `titre identique à ${titles.get(title)}`)
  titles.set(title, file)
  if (descriptions.has(desc)) fail(file, `description identique à ${descriptions.get(desc)}`)
  descriptions.set(desc, file)

  // -------------------------------------------------------------------------
  // 6. JSON-LD : il doit être valide, et son FAQPage doit correspondre mot pour
  //    mot aux questions visibles sur la page.
  // -------------------------------------------------------------------------
  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1]
  if (!ld) {
    fail(file, 'aucun JSON-LD')
  } else {
    let graph
    try {
      graph = JSON.parse(ld)['@graph']
    } catch (err) {
      fail(file, `JSON-LD invalide : ${err.message}`)
    }
    const faq = graph?.find((n) => n['@type'] === 'FAQPage')
    if (faq) {
      const visible = [...html.matchAll(/<div class="p-faq">([\s\S]*?)<\/section>/g)]
        .flatMap((r) => [...r[1].matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)])
        .map((m) => plain(m[1]))
      const marked = faq.mainEntity.map((q) => q.name)
      if (visible.join('|') !== marked.join('|')) {
        fail(file, 'les questions du FAQPage ne correspondent pas aux <summary> visibles')
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Le sitemap couvre exactement les pages indexables — ni plus, ni moins.
// ---------------------------------------------------------------------------
const sitemap = await readFile(path.join(SITE, 'sitemap.xml'), 'utf8').catch(() => null)
if (!sitemap) {
  fail('sitemap.xml', 'absent')
} else {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort()
  const expected = [...indexable.values()].map((p) => `${origin}${p.path}`).sort()
  for (const loc of locs) if (!expected.includes(loc)) fail('sitemap.xml', `URL en trop : ${loc}`)
  for (const url of expected) if (!locs.includes(url)) fail('sitemap.xml', `URL manquante : ${url}`)
}

const robots = await readFile(path.join(SITE, 'robots.txt'), 'utf8').catch(() => null)
if (!robots) fail('robots.txt', 'absent')
else if (!robots.includes(`Sitemap: ${origin}/sitemap.xml`)) fail('robots.txt', 'ne déclare pas le sitemap')

// ---------------------------------------------------------------------------
// Rapport.
// ---------------------------------------------------------------------------
console.log(`${files.length} pages HTML · ${indexable.size} indexables · ${noindex.size} en noindex\n`)
for (const n of notes) console.log(`note  ${n}`)
if (problems.length === 0) {
  console.log('Aucun problème détecté.')
  process.exit(0)
}
console.log(`${problems.length} problème(s) :\n`)
for (const p of problems) console.log(`  ✗ ${p}`)
process.exit(1)
