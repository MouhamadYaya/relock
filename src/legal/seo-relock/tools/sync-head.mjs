/**
 * Écrit le bloc SEO du <head> de chaque page, depuis seo-relock/pages.json.
 *
 * POURQUOI UN GÉNÉRATEUR
 * Un canonical, deux hreflang réciproques, un x-default, sept balises Open
 * Graph et un JSON-LD, sur quatorze pages en deux langues : à la main, une
 * paire finit toujours par se désynchroniser, et un hreflang non réciproque
 * est purement et simplement ignoré par Google. Le fichier pages.json est la
 * seule source ; ce script la rend.
 *
 * IDEMPOTENT — il remplace le contenu entre <!-- seo:start --> et
 * <!-- seo:end -->, et insère ce couple de marqueurs s'il manque.
 *
 *   node src/legal/seo-relock/tools/sync-head.mjs [--check]
 *
 * `--check` n'écrit rien et sort en 1 si un fichier n'est pas à jour : c'est
 * la forme utilisable en CI.
 *
 * LE JSON-LD NE PEUT PAS MENTIR
 * Les questions/réponses de FAQPage ne sont pas rédigées ici : elles sont
 * extraites des <details>/<summary> réellement visibles sur la page. Modifier
 * une réponse dans le HTML met le balisage à jour au prochain passage ; en
 * inventer une dans le JSON-LD est impossible par construction.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SEO = path.resolve(here, '..')
const SITE = path.resolve(SEO, '..')

const START = '<!-- seo:start — généré par seo-relock/tools/sync-head.mjs, ne pas éditer à la main -->'
const END = '<!-- seo:end -->'

const config = JSON.parse(await readFile(path.join(SEO, 'pages.json'), 'utf8'))
const { origin, siteName } = config

const OG_LOCALE = { en: 'en_US', fr: 'fr_CA' }
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Texte brut d'un fragment HTML, entités décodées. */
function plain(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Les FAQ visibles de la page, dans l'ordre du document.
 *
 * Volontairement limité au conteneur `.p-faq` : le menu mobile et le sélecteur
 * de langue du pied de page sont eux aussi des <details>, et les embarquer
 * produirait un FAQPage annonçant « Language » comme question.
 */
function extractFaq(html) {
  const out = []
  const regions = [...html.matchAll(/<div class="p-faq">([\s\S]*?)<\/section>/g)]
    .map((r) => r[1])
    .join('\n')
  const block = /<details[^>]*>([\s\S]*?)<\/details>/g
  let m
  while ((m = block.exec(regions))) {
    const inner = m[1]
    const q = /<summary[^>]*>([\s\S]*?)<\/summary>/.exec(inner)
    if (!q) continue
    const answer = plain(inner.replace(/<summary[\s\S]*?<\/summary>/, ''))
    if (!answer) continue
    out.push({ q: plain(q[1]), a: answer })
  }
  return out
}

const ORG_ID = `${origin}/#organization`
const SITE_ID = `${origin}/#website`

const organization = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: siteName,
  legalName: 'YATECH',
  url: `${origin}/`,
  logo: `${origin}/img/icon-512.png`,
  email: 'contact@getrelock.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '1187C rue Jogues',
    addressLocality: 'Drummondville',
    addressRegion: 'QC',
    postalCode: 'J2B 4X8',
    addressCountry: 'CA',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'contact@getrelock.com',
    availableLanguage: ['en', 'fr'],
  },
}

/**
 * Aucune note, aucun avis, aucun prix : Relock n'a pas encore de fiche App
 * Store publique, et un `aggregateRating` inventé serait à la fois faux et
 * contraire aux règles de Google sur les données structurées.
 */
const software = (lang) => ({
  '@type': 'MobileApplication',
  '@id': `${origin}/#app`,
  name: siteName,
  applicationCategory: 'ProductivityApplication',
  applicationSubCategory: 'App blocker',
  operatingSystem: 'iOS 16.0 or later',
  availableOnDevice: 'iPhone',
  inLanguage: ['en', 'fr'],
  publisher: { '@id': ORG_ID },
  url: `${origin}/`,
  softwareRequirements:
    lang === 'fr'
      ? 'iPhone sous iOS 16 ou version ultérieure, avec l’autorisation Temps d’écran (Family Controls) accordée.'
      : 'An iPhone running iOS 16 or later, with Screen Time (Family Controls) authorization granted.',
  featureList:
    lang === 'fr'
      ? [
          'Délai progressif avant l’ouverture d’une app',
          'Plages horaires de blocage',
          'Limite d’ouvertures quotidiennes',
          'Mode strict, impossible à arrêter avant la fin',
          'Protection anti-désinstallation',
          'Déblocage d’urgence, une fois par semaine',
          'Sélection d’apps et de catégories via Family Controls d’Apple',
        ]
      : [
          'Progressive delay before an app opens',
          'Scheduled blocking time windows',
          'Daily app-opening limit',
          'Strict mode that cannot be stopped before it ends',
          'Uninstall protection',
          'Emergency unlock, once per week',
          'App and category selection through Apple Family Controls',
        ],
})

const website = (lang, url) => ({
  '@type': 'WebSite',
  '@id': SITE_ID,
  name: siteName,
  url: `${origin}/`,
  inLanguage: lang,
  publisher: { '@id': ORG_ID },
})

const breadcrumb = (lang, entry) => {
  const homeName = lang === 'fr' ? 'Accueil' : 'Home'
  const homeUrl = lang === 'fr' ? `${origin}/fr/` : `${origin}/`
  // `breadcrumb` est explicite dans pages.json : dériver le libellé du <title>
  // donnait une miette longue d'une phrase entière.
  const leaf = entry.breadcrumb ?? entry.title
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: homeName, item: homeUrl },
      { '@type': 'ListItem', position: 2, name: leaf, item: `${origin}${entry.path}` },
    ],
  }
}

const article = (lang, entry, url) => ({
  '@type': 'Article',
  headline: entry.title,
  description: entry.description,
  inLanguage: lang,
  mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  image: `${origin}/img/relock-og-${lang}.jpg`,
  author: { '@id': ORG_ID },
  publisher: { '@id': ORG_ID },
  datePublished: config.contentDate,
  dateModified: config.contentDate,
})

const faqPage = (faq) => ({
  '@type': 'FAQPage',
  mainEntity: faq.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
})

function buildHead({ lang, entry, alternates, html }) {
  const url = `${origin}${entry.path}`
  const depth = entry.file.split('/').length - 1
  const up = depth === 0 ? './' : '../'.repeat(depth)
  const ogImage = `${origin}/img/relock-og-${lang}.jpg`

  const graph = []
  for (const kind of entry.schema ?? []) {
    if (kind === 'website') graph.push(website(lang, url))
    else if (kind === 'organization') graph.push(organization)
    else if (kind === 'software') graph.push(software(lang))
    else if (kind === 'breadcrumb') graph.push(breadcrumb(lang, entry))
    else if (kind === 'article') graph.push(article(lang, entry, url))
    else if (kind === 'faq') {
      const faq = extractFaq(html)
      if (faq.length) graph.push(faqPage(faq))
    }
  }

  const isArticle = (entry.schema ?? []).includes('article')

  const lines = [
    `<title>${esc(entry.title)}</title>`,
    `<meta name="description" content="${esc(entry.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
  ]

  // hreflang : chaque variante se cite elle-même ET cite l'autre, sans quoi
  // Google ignore l'ensemble du groupe.
  for (const [code, href] of Object.entries(alternates)) {
    lines.push(`<link rel="alternate" hreflang="${code}" href="${href}" />`)
  }
  lines.push(`<link rel="alternate" hreflang="x-default" href="${alternates.en}" />`)

  lines.push(
    '',
    `<meta property="og:type" content="${isArticle ? 'article' : 'website'}" />`,
    `<meta property="og:site_name" content="${siteName}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`,
    `<meta property="og:locale:alternate" content="${OG_LOCALE[lang === 'en' ? 'fr' : 'en']}" />`,
    `<meta property="og:title" content="${esc(entry.title)}" />`,
    `<meta property="og:description" content="${esc(entry.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(entry.ogImageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(entry.title)}" />`,
    `<meta name="twitter:description" content="${esc(entry.description)}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
    `<meta name="twitter:image:alt" content="${esc(entry.ogImageAlt)}" />`,
    '',
    // Chemins RELATIFS, pas absolus : le site tourne aussi sur *.workers.dev
    // et en local, où une URL https://getrelock.com/... deviendrait une requête
    // multi-origine que la CSP `default-src 'self'` bloquerait en silence.
    `<link rel="icon" href="${up}favicon.svg" type="image/svg+xml" />`,
    `<link rel="apple-touch-icon" href="${up}img/apple-touch-icon.png" />`,
    `<link rel="manifest" href="${up}site.webmanifest" />`,
  )

  if (graph.length) {
    const ld = { '@context': 'https://schema.org', '@graph': graph }
    lines.push(
      '',
      `<script type="application/ld+json">`,
      JSON.stringify(ld, null, 2),
      `</script>`,
    )
  }

  return lines.map((l) => (l ? `    ${l}` : '')).join('\n')
}

function buildNoindexHead(entry) {
  const depth = entry.file.split('/').length - 1
  const up = depth === 0 ? './' : '../'.repeat(depth)
  return [
    `<title>${esc(entry.title)}</title>`,
    `<meta name="robots" content="noindex, follow" />`,
    // Chemins RELATIFS, pas absolus : le site tourne aussi sur *.workers.dev
    // et en local, où une URL https://getrelock.com/... deviendrait une requête
    // multi-origine que la CSP `default-src 'self'` bloquerait en silence.
    `<link rel="icon" href="${up}favicon.svg" type="image/svg+xml" />`,
    `<link rel="apple-touch-icon" href="${up}img/apple-touch-icon.png" />`,
  ]
    .map((l) => `    ${l}`)
    .join('\n')
}

function splice(html, block, file) {
  const marked = `${START}\n${block}\n    ${END}`
  if (html.includes(START)) {
    const s = html.indexOf(START)
    const e = html.indexOf(END, s)
    if (e === -1) throw new Error(`${file}: marqueur seo:start sans seo:end`)
    return html.slice(0, s) + marked + html.slice(e + END.length)
  }
  // Première pose : juste après le viewport, avant le reste du <head>.
  const anchor = /<meta name="viewport"[^>]*>\n/.exec(html)
  if (!anchor) throw new Error(`${file}: pas de <meta name="viewport"> où ancrer le bloc`)
  const at = anchor.index + anchor[0].length
  return `${html.slice(0, at)}    ${marked}\n${html.slice(at)}`
}

/**
 * Les balises que le bloc généré possède désormais ne doivent plus exister en
 * double ailleurs dans le <head> : deux <title> ou deux descriptions, et c'est
 * la mauvaise que Google retient.
 */
function stripLegacy(html) {
  const headEnd = html.indexOf('</head>')
  let head = html.slice(0, headEnd)
  const body = html.slice(headEnd)
  const after = head.indexOf(END)
  const before = head.slice(0, after === -1 ? head.length : after + END.length)
  let tail = after === -1 ? '' : head.slice(after + END.length)
  tail = tail
    .replace(/^[ \t]*<title>[\s\S]*?<\/title>\n?/gm, '')
    .replace(/^[ \t]*<meta name="description"[^>]*>\n?/gm, '')
    .replace(/^[ \t]*<link rel="icon"[^>]*>\n?/gm, '')
  return before + tail + body
}

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
let stale = 0

for (const pair of config.pages) {
  const alternates = { en: `${origin}${pair.en.path}`, fr: `${origin}${pair.fr.path}` }
  for (const lang of ['en', 'fr']) {
    const entry = pair[lang]
    const file = path.join(SITE, entry.file)
    const original = await readFile(file, 'utf8')
    const next = stripLegacy(splice(original, buildHead({ lang, entry, alternates, html: original }), entry.file))
    if (next === original) continue
    stale++
    if (checkOnly) console.log(`obsolète : ${entry.file}`)
    else {
      await writeFile(file, next)
      console.log(`écrit : ${entry.file}`)
    }
  }
}

for (const entry of config.noindex) {
  const file = path.join(SITE, entry.file)
  const original = await readFile(file, 'utf8').catch(() => null)
  if (original === null) continue
  const next = stripLegacy(splice(original, buildNoindexHead(entry), entry.file))
  if (next === original) continue
  stale++
  if (checkOnly) console.log(`obsolète : ${entry.file}`)
  else {
    await writeFile(file, next)
    console.log(`écrit : ${entry.file}`)
  }
}

if (checkOnly && stale) {
  console.error(`\n${stale} page(s) à resynchroniser : node src/legal/seo-relock/tools/sync-head.mjs`)
  process.exit(1)
}
console.log(stale ? `\n${stale} page(s) mise(s) à jour.` : '\nToutes les pages étaient déjà à jour.')
